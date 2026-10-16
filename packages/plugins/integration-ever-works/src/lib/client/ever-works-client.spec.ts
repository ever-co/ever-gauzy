import { EverWorksApiError, EverWorksClient, EverWorksNetworkError, EverWorksUrlError, normaliseApiBaseUrl } from './ever-works-client';
import type { EverWorksHttpRequest, EverWorksHttpResponse, EverWorksTransport } from './ever-works-transport';
import { MockEverWorksServer } from '../testing/mock-ever-works.server';

/** A made-up key, assembled at run time so secret scanners do not take it for a real one. */
const FAKE_KEY = ['ew_int', 'TEST_FIXTURE', 'not', 'a', 'real', 'key'].join('_');

/** A transport answering from a script and recording every request. */
function scripted(responses: Array<EverWorksHttpResponse | Error>): EverWorksTransport & { sent: EverWorksHttpRequest[] } {
	const sent: EverWorksHttpRequest[] = [];
	return {
		sent,
		async send(request) {
			sent.push(request);
			const next = responses.shift();
			if (!next) throw new Error('no scripted response');
			if (next instanceof Error) throw next;
			return next;
		}
	};
}

const ok = (data: unknown = {}): EverWorksHttpResponse => ({ status: 200, headers: {}, data });
const fail = (status: number, code: string, headers: Record<string, string> = {}): EverWorksHttpResponse =>
	MockEverWorksServer.error(status, code, `${code} message`, undefined, headers);

function client(transport: EverWorksTransport, extra: Partial<ConstructorParameters<typeof EverWorksClient>[0]> = {}) {
	const sleeps: number[] = [];
	const c = new EverWorksClient({
		apiBaseUrl: 'https://api.example.test/api',
		apiKey: FAKE_KEY,
		transport,
		connectionId: 'c0ffee00-0000-4000-8000-000000000001',
		sleep: async (ms) => void sleeps.push(ms),
		random: () => 1,
		...extra
	});
	return { c, sleeps };
}

describe('normaliseApiBaseUrl', () => {
	it.each([
		['https://api.example.test/api', 'https://api.example.test/api'],
		['https://api.example.test/api/', 'https://api.example.test/api'],
		['https://api.example.test/api/integrations/v1', 'https://api.example.test/api'],
		['  https://api.example.test  ', 'https://api.example.test']
	])('%s → %s', (input, expected) => expect(normaliseApiBaseUrl(input)).toBe(expected));

	it.each([
		'http://api.example.test/api',
		'https://localhost/api',
		'https://192.168.1.10/api',
		'https://user:pass@api.example.test/api',
		'https://api.example.test/api?x=1',
		'https://api.example.test/api#frag',
		'ftp://api.example.test',
		''
	])('refuses %s', (input) => expect(() => normaliseApiBaseUrl(input)).toThrow(EverWorksUrlError));
});

describe('EverWorksClient', () => {
	it('calls the contract namespace with the key, User-Agent and no scope for whoami', async () => {
		const transport = scripted([ok({ keyId: 'k' })]);
		await client(transport).c.whoami();
		const [request] = transport.sent;
		expect(request.method).toBe('GET');
		expect(request.url).toBe('https://api.example.test/api/integrations/v1/whoami');
		expect(request.headers['Authorization']).toBe(`Bearer ${FAKE_KEY}`);
		expect(request.headers['User-Agent']).toMatch(/^ever-gauzy-ever-works\//);
		expect(request.headers['X-Scope-Slug']).toBeUndefined();
		// A read carries no origin and no idempotency key.
		expect(request.headers['X-Sync-Origin']).toBeUndefined();
		expect(request.headers['Idempotency-Key']).toBeUndefined();
	});

	it('sends origin, scope, act-as, If-Match and an Idempotency-Key on writes', async () => {
		const transport = scripted([ok(), ok()]);
		const { c } = client(transport, { scopeSlug: 'acme' });
		await c.request('POST', '/tasks', { body: { title: 'x' }, idempotencyKey: 'create-1', actAsUserId: 'u1' });
		await c.request('PATCH', '/tasks/t1', { body: { title: 'y' }, ifMatchVersion: 7 });
		const [post, patch] = transport.sent;
		expect(post.headers).toMatchObject({
			'X-Sync-Origin': 'gauzy:c0ffee00-0000-4000-8000-000000000001',
			'X-Scope-Slug': 'acme',
			'X-Act-As-User': 'u1',
			'Idempotency-Key': 'create-1',
			'Content-Type': 'application/json'
		});
		expect(patch.headers['If-Match']).toBe('"7"');
		expect(patch.headers['Idempotency-Key']).toBeUndefined();
		expect(post.body).toEqual({ title: 'x' });
	});

	it('gives every POST an Idempotency-Key, and refuses one longer than 128 characters', async () => {
		const transport = scripted([ok()]);
		const { c } = client(transport);
		await c.request('POST', '/whatever', { body: {} });
		expect(transport.sent[0].headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
		await expect(c.request('POST', '/x', { idempotencyKey: 'k'.repeat(129) })).rejects.toThrow(RangeError);
	});

	it('builds the query, skipping empty values', async () => {
		const transport = scripted([ok({ events: [], nextCursor: null, hasMore: false, head: '0' })]);
		await client(transport).c.events({ after: '41', limit: 100, types: ['task.*', 'team.*'], excludeOrigin: 'gauzy:c1' });
		expect(transport.sent[0].url).toBe(
			'https://api.example.test/api/integrations/v1/events?after=41&limit=100&types=task.*%2Cteam.*&excludeOrigin=gauzy%3Ac1'
		);
	});

	it('retries 5xx with exponential back-off and then succeeds', async () => {
		const transport = scripted([fail(503, 'internal_error'), fail(500, 'internal_error'), ok({ keyId: 'k' })]);
		const { c, sleeps } = client(transport);
		await expect(c.whoami()).resolves.toEqual({ keyId: 'k' });
		expect(transport.sent).toHaveLength(3);
		expect(sleeps).toEqual([500, 1000]);
	});

	it('honours Retry-After on 429 (never sooner than asked)', async () => {
		const transport = scripted([fail(429, 'rate_limited', { 'retry-after': '7' }), ok()]);
		const { c, sleeps } = client(transport);
		await c.whoami();
		expect(sleeps).toEqual([7000]);
	});

	it('gives up on a Retry-After beyond the policy and reports the 429', async () => {
		const transport = scripted([fail(429, 'rate_limited', { 'retry-after': '3600' })]);
		await expect(client(transport).c.whoami()).rejects.toMatchObject({ status: 429, code: 'rate_limited', retryAfterSeconds: 3600 });
		expect(transport.sent).toHaveLength(1);
	});

	it('stops after maxAttempts and reports the last failure', async () => {
		const transport = scripted([fail(502, 'internal_error'), fail(502, 'internal_error'), fail(502, 'internal_error')]);
		await expect(client(transport).c.whoami()).rejects.toBeInstanceOf(EverWorksApiError);
		expect(transport.sent).toHaveLength(3);
	});

	it.each([
		[401, 'invalid_key'],
		[403, 'scope_missing'],
		[404, 'not_found'],
		[409, 'transition_blocked'],
		[412, 'version_mismatch'],
		[422, 'domain_rule']
	])('does not retry %i (%s) and maps the contract error', async (status, code) => {
		const transport = scripted([fail(status, code)]);
		const error = await client(transport).c.whoami().catch((e) => e);
		expect(error).toBeInstanceOf(EverWorksApiError);
		expect(error).toMatchObject({ status, code, retryable: false });
		expect(transport.sent).toHaveLength(1);
	});

	it('maps a body that is not the contract envelope to a fallback code without echoing it', async () => {
		const transport = scripted([{ status: 401, headers: {}, data: '<html>Unauthorized ew_int_leak</html>' }]);
		const error = await client(transport).c.whoami().catch((e) => e);
		expect(error).toMatchObject({ status: 401, code: 'invalid_key' });
		expect(error.message).not.toContain('ew_int_leak');
	});

	it('retries network failures and reports only a code', async () => {
		const reset = Object.assign(new Error('socket hang up at https://api.example.test with Bearer ew_int_x'), { code: 'ECONNRESET' });
		const transport = scripted([reset, reset, reset]);
		const error = await client(transport).c.whoami().catch((e) => e);
		expect(error).toBeInstanceOf(EverWorksNetworkError);
		expect(error.reason).toBe('ECONNRESET');
		expect(error.message).not.toContain('ew_int_');
		expect(transport.sent).toHaveLength(3);
	});

	it('parses Retry-After as seconds or an HTTP date', () => {
		const now = Date.parse('2026-10-15T20:00:00Z');
		expect(EverWorksClient.retryAfter('12', now)).toBe(12);
		expect(EverWorksClient.retryAfter('Thu, 15 Oct 2026 20:00:30 GMT', now)).toBe(30);
		expect(EverWorksClient.retryAfter('garbage', now)).toBeNull();
		expect(EverWorksClient.retryAfter(undefined, now)).toBeNull();
	});

	it('works end to end against the mock Ever Works (whoami, webhook create with replay, 401 on a revoked key)', async () => {
		const mock = new MockEverWorksServer();
		const key = mock.addKey();
		const c = new EverWorksClient({ apiBaseUrl: 'https://ew.mock/api', apiKey: key, transport: mock.transport(), connectionId: 'c1' });
		const whoami = await c.whoami();
		expect(whoami.tenant).toEqual(mock.tenant);
		const orgId = whoami.organizations[0].id;
		const body = { url: 'https://gauzy.example/api/integration/ever-works/webhooks/c1', events: ['task.*'], organizationIds: [orgId] };
		const first = await c.createWebhook(body, 'same-key');
		const replay = await c.createWebhook(body, 'same-key');
		expect(replay.id).toBe(first.id);
		expect(first.secret?.length).toBeGreaterThanOrEqual(32);
		expect(mock.webhooks.size).toBe(1);
		mock.revokeKey(key);
		await expect(c.whoami()).rejects.toMatchObject({ status: 401, code: 'invalid_key' });
	});
});
