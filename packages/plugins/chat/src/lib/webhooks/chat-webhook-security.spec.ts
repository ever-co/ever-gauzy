// cspell:ignore gzcwh xxcwh
/**
 * The security pieces of incoming webhooks: the URL secret and its hash, the sealed signing secret, the signature of
 * an interaction callback (the platform's own `X-Signature` contract, verified with core's verifier), the rate limits,
 * and the egress rule for interaction URLs (public https hosts only, every resolved address judged).
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application); its webhook signer and
 * verifier are the real ones, loaded from their own file.
 */
jest.mock('@gauzy/core', () => {
	const signature = jest.requireActual('../../../../../core/src/lib/webhook/webhook-signature');
	return { __esModule: true, signWebhookPayload: signature.signWebhookPayload, verifyWebhookSignature: signature.verifyWebhookSignature };
});

import { createServer, IncomingMessage, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { WebhookHeader } from '@gauzy/contracts';
import { verifyWebhookSignature } from '@gauzy/core';
import { ChatInteractionTransport, interactionUrlRefusal, signedCallback } from './chat-interaction-transport';
import { chatWebhookRateLimits, ChatWebhookRateLimiter } from './chat-webhook-rate-limiter';
import { ChatWebhookSecretBox, ChatWebhookSecretError } from './chat-webhook-secret-box';
import { isWebhookTokenShaped, newSigningSecret, newWebhookToken, webhookTokenHash, webhookTokenHint } from './chat-webhook-token';
import { isChatWebhooksEnabled } from './chat-webhooks-enabled';

const KEY = Buffer.alloc(32, 7).toString('base64');

describe('chat webhook security', () => {
	describe('the flag', () => {
		it('is on only for exactly "true", and reports any other value once without repeating it', () => {
			const warn = jest.fn();
			expect(isChatWebhooksEnabled({})).toBe(false);
			expect(isChatWebhooksEnabled({ GAUZY_CHAT_WEBHOOKS_ENABLED: 'false' })).toBe(false);
			expect(isChatWebhooksEnabled({ GAUZY_CHAT_WEBHOOKS_ENABLED: 'true' })).toBe(true);
			expect(isChatWebhooksEnabled({ GAUZY_CHAT_WEBHOOKS_ENABLED: 'TRUE' }, warn)).toBe(false);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0][0]).not.toContain('TRUE');
		});
	});

	describe('the URL secret', () => {
		it('is 256 random bits behind a prefix, stored as its SHA-256 only', () => {
			const token = newWebhookToken();
			expect(isWebhookTokenShaped(token)).toBe(true);
			expect(token).not.toBe(newWebhookToken());
			const hash = webhookTokenHash(token);
			expect(hash).toMatch(/^[0-9a-f]{64}$/);
			expect(hash).not.toContain(token.slice(6, 20));
			expect(webhookTokenHash(token)).toBe(hash);
			expect(webhookTokenHint(token)).toBe(token.slice(-4));
		});

		it('refuses anything not shaped like one before any lookup', () => {
			for (const value of ['', 'gzcwh_short', `gzcwh_${'a'.repeat(42)}!`, '../../etc/passwd', `xxcwh_${'a'.repeat(43)}`, 42, null]) {
				expect(isWebhookTokenShaped(value)).toBe(false);
			}
		});
	});

	describe('the signing secret at rest', () => {
		it('opens only for its own row, and only with the key it was sealed under', () => {
			const box = new ChatWebhookSecretBox({ ENCRYPTION_KEY: KEY });
			const secret = newSigningSecret();
			const sealed = box.seal(secret, 'w1');
			expect(sealed.startsWith('cw1:k:')).toBe(true);
			expect(sealed).not.toContain(secret);
			expect(box.open(sealed, 'w1')).toBe(secret);
			expect(() => box.open(sealed, 'w2')).toThrow(ChatWebhookSecretError);
			expect(() => new ChatWebhookSecretBox({ ENCRYPTION_KEY: Buffer.alloc(32, 8).toString('base64') }).open(sealed, 'w1')).toThrow(ChatWebhookSecretError);
		});

		it('falls back to a key derived from a non-default JWT_SECRET, and refuses to seal with nothing usable', () => {
			const jwt = new ChatWebhookSecretBox({ JWT_SECRET: 'a-long-installation-specific-jwt-secret-value' });
			const sealed = jwt.seal('s', 'w1');
			expect(sealed.startsWith('cw1:j:')).toBe(true);
			// Setting ENCRYPTION_KEY later still opens what was sealed under JWT_SECRET.
			expect(new ChatWebhookSecretBox({ JWT_SECRET: 'a-long-installation-specific-jwt-secret-value', ENCRYPTION_KEY: KEY }).open(sealed, 'w1')).toBe('s');
			expect(new ChatWebhookSecretBox({}).problem()).toBe('no_secret');
			expect(new ChatWebhookSecretBox({ ENCRYPTION_KEY: 'too-short' }).problem()).toBe('encryption_key_malformed');
			expect(() => new ChatWebhookSecretBox({}).seal('s', 'w1')).toThrow(ChatWebhookSecretError);
		});
	});

	describe('the callback signature', () => {
		const payload = { type: 'block_actions', interactionId: 'i-1', action: { actionId: 'ack' } };

		it('is X-Signature t=…,v1=… over "<t>.<body>", verifiable with the platform verifier, with the interaction id as Idempotency-Key', () => {
			const { headers, body } = signedCallback('secret-1', 'i-1', 1, payload, 1_700_000_000);
			expect(JSON.parse(body)).toEqual(payload);
			expect(headers[WebhookHeader.SIGNATURE]).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
			expect(headers['Idempotency-Key']).toBe('i-1');
			expect(headers['X-Interaction-Id']).toBe('i-1');
			expect(verifyWebhookSignature('secret-1', body, headers[WebhookHeader.SIGNATURE], { now: 1_700_000_010 })).toBe(true);
			expect(verifyWebhookSignature('other', body, headers[WebhookHeader.SIGNATURE], { now: 1_700_000_010 })).toBe(false);
			expect(verifyWebhookSignature('secret-1', body.replace('ack', 'nak'), headers[WebhookHeader.SIGNATURE], { now: 1_700_000_010 })).toBe(false);
		});

		it('falls outside the replay window after five minutes', () => {
			const { headers, body } = signedCallback('secret-1', 'i-1', 1, payload, 1_700_000_000);
			expect(verifyWebhookSignature('secret-1', body, headers[WebhookHeader.SIGNATURE], { now: 1_700_000_000 + 301 })).toBe(false);
		});

		it('is signed afresh on a retry: a new timestamp, the same interaction id', () => {
			const first = signedCallback('secret-1', 'i-1', 1, payload, 1_700_000_000);
			const retry = signedCallback('secret-1', 'i-1', 2, payload, 1_700_000_030);
			expect(retry.headers[WebhookHeader.SIGNATURE]).not.toBe(first.headers[WebhookHeader.SIGNATURE]);
			expect(retry.headers['Idempotency-Key']).toBe(first.headers['Idempotency-Key']);
			expect(retry.headers[WebhookHeader.ATTEMPT]).toBe('2');
		});
	});

	describe('rate limits', () => {
		it('takes the limits from the environment, the defaults for anything unusable', () => {
			expect(chatWebhookRateLimits({})).toEqual({ perMinute: 60, burst: 20, organizationPerMinute: 600, organizationBurst: 100 });
			expect(chatWebhookRateLimits({ GAUZY_CHAT_WEBHOOK_RATE_PER_MINUTE: '50', GAUZY_CHAT_WEBHOOK_RATE_BURST: '-1', GAUZY_CHAT_WEBHOOK_ORG_RATE_BURST: 'x' })).toEqual({
				perMinute: 50,
				burst: 20,
				organizationPerMinute: 600,
				organizationBurst: 100
			});
		});

		it('refuses the post after the burst with a Retry-After, per webhook', async () => {
			const limiter = new ChatWebhookRateLimiter();
			const limits = { perMinute: 60, burst: 20, organizationPerMinute: 600, organizationBurst: 100 };
			const decisions = [];
			for (let i = 0; i < 50; i++) decisions.push(await limiter.take('w1', 'org-1', limits));
			expect(decisions.filter((decision) => decision.allowed)).toHaveLength(20);
			const refused = decisions[20];
			expect(refused.allowed).toBe(false);
			expect(refused.allowed === false && refused.retryAfterSeconds).toBeGreaterThan(0);
			// Another webhook of the same organization still posts.
			expect((await limiter.take('w2', 'org-1', limits)).allowed).toBe(true);
		});

		it('counts one minute per webhook and the organization across its webhooks', async () => {
			const limiter = new ChatWebhookRateLimiter();
			const perWebhook = { perMinute: 5, burst: 100, organizationPerMinute: 1000, organizationBurst: 1000 };
			for (let i = 0; i < 5; i++) expect((await limiter.take('w1', 'org-1', perWebhook)).allowed).toBe(true);
			expect((await limiter.take('w1', 'org-1', perWebhook)).allowed).toBe(false);
			const perOrganization = { perMinute: 100, burst: 100, organizationPerMinute: 3, organizationBurst: 100 };
			expect((await limiter.take('a', 'org-2', perOrganization)).allowed).toBe(true);
			expect((await limiter.take('b', 'org-2', perOrganization)).allowed).toBe(true);
			expect((await limiter.take('c', 'org-2', perOrganization)).allowed).toBe(true);
			expect((await limiter.take('d', 'org-2', perOrganization)).allowed).toBe(false);
		});
	});

	describe('interaction URLs (SSRF)', () => {
		const publicResolver = async () => ['93.184.216.34'];

		it('refuses a URL that is not https, or names a private, loopback, link-local or metadata address', async () => {
			expect(await interactionUrlRefusal('http://hooks.example.com/x', undefined, publicResolver)).toMatch(/https/);
			for (const url of [
				'https://10.0.0.8/x',
				'https://127.0.0.1/x',
				'https://169.254.169.254/latest/meta-data',
				'https://[::1]/x',
				'https://[fd00::1]/x',
				'https://[::ffff:127.0.0.1]/x',
				'https://localhost/x',
				'https://user:pass@hooks.example.com/x',
				'https://hooks.example.com:6379/x'
			]) {
				expect(await interactionUrlRefusal(url, undefined, publicResolver)).not.toBeNull();
			}
			expect(await interactionUrlRefusal('not a url')).toMatch(/not a URL/);
		});

		it('refuses a public-looking host that resolves to a private address (any of its answers)', async () => {
			expect(await interactionUrlRefusal('https://hooks.example.com/x', undefined, async () => ['10.1.2.3'])).toMatch(/public host/);
			expect(await interactionUrlRefusal('https://hooks.example.com/x', undefined, async () => ['93.184.216.34', '192.168.1.1'])).toMatch(/public host/);
			expect(await interactionUrlRefusal('https://hooks.example.com/x', undefined, async () => ['::ffff:10.0.0.1'])).toMatch(/public host/);
			expect(await interactionUrlRefusal('https://hooks.example.com/x', undefined, publicResolver)).toBeNull();
		});

		it('does not post to a refused target at all', async () => {
			const transport = new ChatInteractionTransport();
			transport.resolver = async () => ['127.0.0.1'];
			const attempt = await transport.post('https://hooks.example.com/x', {}, '{}');
			expect(attempt).toEqual({ outcome: 'refused', status: 0, error: 'target_refused' });
		});
	});

	describe('the transport', () => {
		let server: Server;
		let port: number;
		const received: Array<{ headers: IncomingMessage['headers']; body: string }> = [];
		let answer: { status: number; body: string; headers?: Record<string, string>; breakOff?: boolean } = { status: 200, body: '' };

		beforeAll(async () => {
			server = createServer((request, response) => {
				let body = '';
				request.on('data', (chunk) => (body += chunk));
				request.on('end', () => {
					received.push({ headers: request.headers, body });
					if (answer.breakOff) {
						// The headers and half the reply, then the connection drops.
						response.writeHead(answer.status, { 'Content-Type': 'application/json', 'Content-Length': String(answer.body.length * 2) });
						response.write(answer.body);
						setTimeout(() => response.socket?.destroy(), 20);
						return;
					}
					response.writeHead(answer.status, { 'Content-Type': 'application/json', ...(answer.headers ?? {}) });
					response.end(answer.body);
				});
			});
			await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
			port = (server.address() as AddressInfo).port;
		});
		afterAll(
			() =>
				new Promise<void>((resolve) => {
					server.closeAllConnections();
					server.close(() => resolve());
				})
		);

		/** The guard narrowed to reach this local test server, and nothing else of it changed. */
		function localTransport(): ChatInteractionTransport {
			const transport = new ChatInteractionTransport();
			transport.policy = { isAllowedAddress: (address) => address === '127.0.0.1', allowedPorts: [port], allowedProtocols: ['http:'] };
			transport.resolver = async () => ['127.0.0.1'];
			return transport;
		}

		it('posts the signed body with its headers and reads the reply', async () => {
			answer = { status: 200, body: '{"text":"Acknowledged"}' };
			const { headers, body } = signedCallback('secret-1', 'i-9', 1, { hello: 'world' });
			const attempt = await localTransport().post(`http://hooks.example.com:${port}/interact`, headers, body);
			expect(attempt.outcome).toBe('delivered');
			expect(attempt.outcome === 'delivered' && attempt.body.toString('utf8')).toBe('{"text":"Acknowledged"}');
			const last = received[received.length - 1];
			expect(last.body).toBe(body);
			expect(last.headers['idempotency-key']).toBe('i-9');
			expect(verifyWebhookSignature('secret-1', last.body, String(last.headers['x-signature']))).toBe(true);
		});

		it('retries a 2xx whose reply breaks off, so the app can answer again under the same interaction id', async () => {
			answer = { status: 200, body: '{"text":"Acknowledged', breakOff: true };
			const attempt = await localTransport().post(`http://hooks.example.com:${port}/x`, {}, '{}');
			expect(attempt.outcome).toBe('retry');
		});

		it('retries a 5xx or 429, refuses a 4xx, and never follows a redirect', async () => {
			answer = { status: 503, body: '' };
			expect((await localTransport().post(`http://hooks.example.com:${port}/x`, {}, '{}')).outcome).toBe('retry');
			answer = { status: 429, body: '' };
			expect((await localTransport().post(`http://hooks.example.com:${port}/x`, {}, '{}')).outcome).toBe('retry');
			answer = { status: 400, body: '' };
			expect((await localTransport().post(`http://hooks.example.com:${port}/x`, {}, '{}')).outcome).toBe('refused');
			answer = { status: 302, body: '', headers: { Location: 'http://169.254.169.254/latest' } };
			const before = received.length;
			expect(await localTransport().post(`http://hooks.example.com:${port}/x`, {}, '{}')).toEqual({ outcome: 'refused', status: 302, error: 'http_302' });
			expect(received.length).toBe(before + 1);
		});
	});
});
