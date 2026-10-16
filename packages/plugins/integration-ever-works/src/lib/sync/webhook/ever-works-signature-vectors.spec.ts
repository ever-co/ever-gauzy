/**
 * The webhook signature check against the contract's shared test vectors (ever-works
 * `docs/specs/features/integrations-api-v1/contract/webhook-signature-vectors.json`, copied into
 * `testing/contract/`): Gauzy's `verifyWebhookSignature` — the function the webhook route calls —
 * must reproduce `expected` for every vector, including the malformed ones (rejected, never thrown).
 * The mock Ever Works server's deliveries must verify the same way, and the contract's example
 * envelopes must pass the engine's envelope check.
 */
// The function itself, from its source: `@gauzy/core`'s barrel boots the whole application.
import { verifyWebhookSignature } from '../../../../../../core/src/lib/webhook/webhook-signature';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MockEverWorksServer } from '../../testing/mock-ever-works.server';
import { compareSeq, EverWorksEnvelopeError, parseEverWorksEnvelope } from '../inbound/ever-works-envelope';

const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, '../../testing/contract', name), 'utf8'));
const vectors = fixture('webhook-signature-vectors.test.json') as { contractVersion: string; header: string; vectors: unknown[] };
const eventsPage = fixture('events-page.test.json') as { events: unknown[] };
const taskUpdated = fixture('task.updated.test.json') as Record<string, unknown>;

type Vector = { name: string; secret: string; body: string; header: string; now: number; expected: boolean; toleranceSeconds: number };

describe('webhook signature vectors (contract v1, B.5)', () => {
	it('carries the vectors of the contract version this plugin speaks', () => {
		expect(vectors.contractVersion).toBe('1');
		expect(vectors.header).toBe('X-Ever-Works-Signature');
		expect((vectors.vectors as Vector[]).length).toBeGreaterThanOrEqual(20);
	});

	it.each((vectors.vectors as Vector[]).map((v) => [v.name, v] as const))('%s', (_name, vector) => {
		const verify = () =>
			verifyWebhookSignature(vector.secret, vector.body, vector.header, { now: vector.now, toleranceSeconds: vector.toleranceSeconds });
		expect(verify).not.toThrow();
		expect(verify()).toBe(vector.expected);
	});
});

describe('the mock Ever Works signs as the contract says', () => {
	it('a delivery verifies with the subscription secret, and not with another', async () => {
		const mock = new MockEverWorksServer();
		const key = mock.addKey();
		const orgId = mock.keys.get(key)!.organizations[0].id;
		const deliveries: Array<{ headers: Record<string, string>; body: string }> = [];
		mock.deliver = async (_url, headers, body) => {
			deliveries.push({ headers, body });
			return 202;
		};
		const created = await mock.handle({
			method: 'POST',
			url: 'https://ew.mock/api/integrations/v1/webhooks',
			headers: { Authorization: `Bearer ${key}` },
			body: { url: 'https://gauzy.example/hook', events: ['task.*'], organizationIds: [orgId] },
			timeoutMs: 0
		});
		const secret = (created.data as { secret: string }).secret;
		await mock.emit({
			type: 'task.updated',
			organizationId: orgId,
			aggregate: { type: 'task', id: 't1', version: 2 },
			actor: { type: 'user', id: 'u1' },
			data: { id: 't1' }
		});
		expect(deliveries).toHaveLength(1);
		const { headers, body } = deliveries[0];
		expect(verifyWebhookSignature(secret, body, headers['x-ever-works-signature'])).toBe(true);
		expect(verifyWebhookSignature(`${secret}x`, body, headers['x-ever-works-signature'])).toBe(false);
		expect(headers['x-ever-works-event-id']).toBe(JSON.parse(body).id);
		expect(parseEverWorksEnvelope(JSON.parse(body)).type).toBe('task.updated');
	});
});

describe('envelope check against the contract examples (B.3)', () => {
	it('accepts every example envelope', () => {
		for (const envelope of [...(eventsPage as { events: unknown[] }).events, taskUpdated]) {
			expect(() => parseEverWorksEnvelope(envelope)).not.toThrow();
		}
	});

	it.each([
		['not an object', 'x'],
		['no id', { ...taskUpdated, id: '' }],
		['a numeric seq', { ...taskUpdated, seq: 12 }],
		['a non-decimal seq', { ...taskUpdated, seq: '0x1f' }],
		['a type without a domain', { ...taskUpdated, type: 'updated' }],
		['no aggregate', { ...taskUpdated, aggregate: null }],
		['a fractional aggregate version', { ...taskUpdated, aggregate: { type: 'task', id: 'x', version: 1.5 } }],
		['no data', { ...taskUpdated, data: null }]
	])('refuses %s', (_name, value) => {
		expect(() => parseEverWorksEnvelope(value)).toThrow(EverWorksEnvelopeError);
	});

	it('orders seq as integers, beyond 2^53', () => {
		expect(compareSeq('9', '10')).toBe(-1);
		expect(compareSeq('9007199254740993', '9007199254740992')).toBe(1);
		expect(compareSeq('42', '42')).toBe(0);
	});
});
