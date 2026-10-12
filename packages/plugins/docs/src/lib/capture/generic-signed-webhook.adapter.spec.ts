import { createHmac } from 'crypto';
import {
	DOCS_INBOUND_SIGNATURE_HEADER,
	DOCS_INBOUND_SIGNATURE_TOLERANCE_MS,
	DOCS_INBOUND_TIMESTAMP_HEADER,
	ENV_GAUZY_DOCS_INBOUND_WEBHOOK_SECRET
} from '../docs.constants';
import { GenericSignedWebhookAdapter } from './generic-signed-webhook.adapter';
import { IInboundWebhookRequest } from './inbound-email.types';

const SECRET = 'super-secret-webhook-key';

/** Signs a payload exactly the way the documented scheme prescribes. */
const sign = (timestamp: string | number, rawBody: string, secret = SECRET): string =>
	createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');

/** Builds a signed request with a raw body (byte-exact verification path). */
const signedRequest = (body: any, options: { timestamp?: number; secret?: string } = {}): IInboundWebhookRequest => {
	const rawBody = JSON.stringify(body);
	const timestamp = options.timestamp ?? Date.now();
	return {
		headers: {
			[DOCS_INBOUND_SIGNATURE_HEADER]: sign(timestamp, rawBody, options.secret),
			[DOCS_INBOUND_TIMESTAMP_HEADER]: String(timestamp)
		},
		body,
		rawBody
	};
};

describe('GenericSignedWebhookAdapter (spec 07 §17.2)', () => {
	let adapter: GenericSignedWebhookAdapter;
	const originalSecret = process.env[ENV_GAUZY_DOCS_INBOUND_WEBHOOK_SECRET];

	beforeEach(() => {
		process.env[ENV_GAUZY_DOCS_INBOUND_WEBHOOK_SECRET] = SECRET;
		adapter = new GenericSignedWebhookAdapter();
	});

	afterAll(() => {
		if (originalSecret === undefined) {
			delete process.env[ENV_GAUZY_DOCS_INBOUND_WEBHOOK_SECRET];
		} else {
			process.env[ENV_GAUZY_DOCS_INBOUND_WEBHOOK_SECRET] = originalSecret;
		}
	});

	describe('verifySignature', () => {
		it('accepts a correctly signed, fresh request', () => {
			expect(adapter.verifySignature(signedRequest({ recipient: 'docs-abc@example.com' }))).toBe(true);
		});

		it('accepts a Unix-SECONDS timestamp as well as milliseconds', () => {
			const seconds = Math.floor(Date.now() / 1000);
			const body = { recipient: 'docs-abc@example.com' };
			const rawBody = JSON.stringify(body);

			expect(
				adapter.verifySignature({
					headers: {
						[DOCS_INBOUND_SIGNATURE_HEADER]: sign(seconds, rawBody),
						[DOCS_INBOUND_TIMESTAMP_HEADER]: String(seconds)
					},
					body,
					rawBody
				})
			).toBe(true);
		});

		it('reads the signature headers case-insensitively', () => {
			const request = signedRequest({ recipient: 'docs-abc@example.com' });
			const upperCased: IInboundWebhookRequest = {
				...request,
				headers: {
					[DOCS_INBOUND_SIGNATURE_HEADER.toUpperCase()]: request.headers[DOCS_INBOUND_SIGNATURE_HEADER],
					[DOCS_INBOUND_TIMESTAMP_HEADER.toUpperCase()]: request.headers[DOCS_INBOUND_TIMESTAMP_HEADER]
				}
			};
			expect(adapter.verifySignature(upperCased)).toBe(true);
		});

		it('rejects a signature produced with the wrong secret', () => {
			expect(
				adapter.verifySignature(signedRequest({ recipient: 'docs-abc@example.com' }, { secret: 'wrong-key' }))
			).toBe(false);
		});

		it('rejects a tampered body (the signature covers the raw bytes)', () => {
			const request = signedRequest({ recipient: 'docs-abc@example.com' });
			const tampered: IInboundWebhookRequest = { ...request, rawBody: '{"recipient":"docs-evil@example.com"}' };
			expect(adapter.verifySignature(tampered)).toBe(false);
		});

		it('rejects a replayed request outside the tolerance window', () => {
			const stale = Date.now() - (DOCS_INBOUND_SIGNATURE_TOLERANCE_MS + 60_000);
			expect(adapter.verifySignature(signedRequest({ recipient: 'x' }, { timestamp: stale }))).toBe(false);
		});

		it('accepts a request just inside the tolerance window', () => {
			const recent = Date.now() - (DOCS_INBOUND_SIGNATURE_TOLERANCE_MS - 60_000);
			expect(adapter.verifySignature(signedRequest({ recipient: 'x' }, { timestamp: recent }))).toBe(true);
		});

		it('rejects a request with missing signature or timestamp headers', () => {
			const request = signedRequest({ recipient: 'x' });

			expect(adapter.verifySignature({ ...request, headers: {} })).toBe(false);
			expect(
				adapter.verifySignature({
					...request,
					headers: { [DOCS_INBOUND_SIGNATURE_HEADER]: request.headers[DOCS_INBOUND_SIGNATURE_HEADER] }
				})
			).toBe(false);
		});

		it('rejects a non-numeric timestamp instead of throwing', () => {
			const request = signedRequest({ recipient: 'x' });
			expect(
				adapter.verifySignature({
					...request,
					headers: { ...request.headers, [DOCS_INBOUND_TIMESTAMP_HEADER]: 'yesterday' }
				})
			).toBe(false);
		});

		it('fails CLOSED when no webhook secret is configured', () => {
			const request = signedRequest({ recipient: 'x' });
			delete process.env[ENV_GAUZY_DOCS_INBOUND_WEBHOOK_SECRET];

			expect(adapter.verifySignature(request)).toBe(false);
		});

		it('never throws on a hostile / malformed request', () => {
			expect(adapter.verifySignature({ headers: null as any, body: undefined })).toBe(false);
			expect(adapter.verifySignature(undefined as any)).toBe(false);
		});

		it('rejects a REPLAY of a valid, still-fresh delivery', () => {
			// The freshness window is not replay protection: without a seen-signature set a
			// captured delivery could be resubmitted at will inside the tolerance, and each
			// replay creates another copy of the same attachments as new documents.
			const request = signedRequest({ recipient: 'docs-abc@example.com' });

			expect(adapter.verifySignature(request)).toBe(true);
			expect(adapter.verifySignature(request)).toBe(false);
			expect(adapter.verifySignature({ ...request })).toBe(false);
		});

		it('still accepts a DIFFERENT delivery signed in the same window', () => {
			expect(adapter.verifySignature(signedRequest({ recipient: 'docs-abc@example.com' }))).toBe(true);
			expect(adapter.verifySignature(signedRequest({ recipient: 'docs-def@example.com' }))).toBe(true);
		});

		it('does not record UNVERIFIED signatures (a bad secret cannot poison the replay set)', () => {
			const body = { recipient: 'docs-abc@example.com' };
			const timestamp = Date.now();
			const rawBody = JSON.stringify(body);
			const forged: IInboundWebhookRequest = {
				headers: {
					[DOCS_INBOUND_SIGNATURE_HEADER]: sign(timestamp, rawBody, 'wrong-key'),
					[DOCS_INBOUND_TIMESTAMP_HEADER]: String(timestamp)
				},
				body,
				rawBody
			};

			expect(adapter.verifySignature(forged)).toBe(false);
			// The genuine delivery of the same message must still get through.
			expect(adapter.verifySignature(signedRequest(body, { timestamp }))).toBe(true);
		});

		it('bounds the replay set by the freshness window (stale entries are pruned)', () => {
			const request = signedRequest({ recipient: 'docs-abc@example.com' });
			expect(adapter.verifySignature(request)).toBe(true);
			expect((adapter as any).seenSignatures.size).toBe(1);

			// Past the tolerance the old entry buys nothing — `isFresh` already rejects that
			// request — so the next verified delivery prunes it instead of accumulating.
			jest.useFakeTimers().setSystemTime(Date.now() + DOCS_INBOUND_SIGNATURE_TOLERANCE_MS + 60_000);
			try {
				expect(adapter.verifySignature(request)).toBe(false); // stale — replay window closed
				expect(adapter.verifySignature(signedRequest({ recipient: 'docs-ghi@example.com' }))).toBe(true);
				expect((adapter as any).seenSignatures.size).toBe(1);
			} finally {
				jest.useRealTimers();
			}
		});

		it('verifies against the canonical JSON fallback when rawBody is absent', () => {
			const body = { recipient: 'docs-abc@example.com' };
			const timestamp = Date.now();

			expect(
				adapter.verifySignature({
					headers: {
						[DOCS_INBOUND_SIGNATURE_HEADER]: sign(timestamp, JSON.stringify(body)),
						[DOCS_INBOUND_TIMESTAMP_HEADER]: String(timestamp)
					},
					body
				})
			).toBe(true);
		});
	});

	describe('parse', () => {
		it('normalizes the generic payload and base64-decodes attachments', () => {
			const content = Buffer.from('%PDF-1.7 hello');
			const parsed = adapter.parse({
				headers: {},
				body: {
					recipient: 'docs-0123456789abcdef@example.com',
					from: 'sender@example.com',
					subject: 'Invoice 42',
					spf: 'pass',
					dkim: 'PASS',
					attachments: [
						{ fileName: 'invoice.pdf', contentType: 'application/pdf', content: content.toString('base64') }
					]
				}
			});

			expect(parsed.recipient).toBe('docs-0123456789abcdef@example.com');
			expect(parsed.sender).toBe('sender@example.com');
			expect(parsed.spfPass).toBe(true);
			expect(parsed.dkimPass).toBe(true);
			expect(parsed.attachments).toHaveLength(1);
			expect(parsed.attachments[0].content.equals(content)).toBe(true);
			expect(parsed.attachments[0].sizeBytes).toBe(content.length);
			// No sizeBytes on the body ⇒ derived from the attachments.
			expect(parsed.sizeBytes).toBe(content.length);
		});

		it('strips path separators out of attachment file names', () => {
			const parsed = adapter.parse({
				headers: {},
				body: {
					recipient: 'docs-token@example.com',
					attachments: [{ fileName: '../../etc/passwd', content: Buffer.from('x').toString('base64') }]
				}
			});
			expect(parsed.attachments[0].fileName).toBe('.._.._etc_passwd');
		});

		it('drops attachments with empty content and tolerates a missing attachments array', () => {
			const parsed = adapter.parse({
				headers: {},
				body: {
					recipient: 'docs-token@example.com',
					attachments: [{ fileName: 'empty.txt', content: '' }]
				}
			});
			expect(parsed.attachments).toHaveLength(0);

			expect(adapter.parse({ headers: {}, body: { recipient: 'docs-token@example.com' } }).attachments).toEqual(
				[]
			);
		});

		it('leaves SPF/DKIM undefined when the provider reports nothing', () => {
			const parsed = adapter.parse({ headers: {}, body: { recipient: 'docs-token@example.com' } });

			expect(parsed.spfPass).toBeUndefined();
			expect(parsed.dkimPass).toBeUndefined();
		});
	});
});
