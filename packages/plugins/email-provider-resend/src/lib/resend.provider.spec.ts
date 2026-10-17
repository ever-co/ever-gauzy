// cspell:ignore svix whsec
// `@gauzy/plugin-inbox` is used from source with its real MIME parser and replay guard; `@gauzy/core` (whose barrel
// boots the application) is not needed by the parts used here.
jest.mock('@gauzy/core', () => ({ EVER_REDIS_CLIENT: 'EVER_REDIS_CLIENT' }));
jest.mock('@gauzy/plugin-inbox', () => ({
	...jest.requireActual('../../../inbox/src/lib/email/inbound/mime'),
	InboundReplayGuard: jest.requireActual('../../../inbox/src/lib/email/inbound/replay-guard.service')
		.InboundReplayGuard
}));

import { UnauthorizedException } from '@nestjs/common';
import { isResendEnabled } from './resend-enabled';
import { FetchLike, RESEND_MAX_DOWNLOAD_BYTES, ResendApiClient } from './resend-api.client';
import { ResendProvider } from './resend.provider';
import { displayName } from './resend-transport';
import { svixSignature, verifySvixSignature } from './svix-signature';
import {
	ATTACHMENT_URL,
	DOMAINS,
	EMAIL_RECEIVED_EVENT,
	RECEIVED_ATTACHMENTS,
	RECEIVED_EMAIL,
	RECEIVED_EMAIL_ID
} from './testing/resend-payloads';

const SECRET = `whsec_${Buffer.alloc(24, 5).toString('base64')}`;
// A placeholder in the key's shape (no real key is used anywhere in these tests).
const API_KEY = `re_${'x'.repeat(8)}`;
const account = {
	id: 'a0000000-0000-4000-8000-00000000000a',
	providerId: 'resend',
	tenantId: 't0000000-0000-4000-8000-00000000000t',
	organizationId: 'o0000000-0000-4000-8000-00000000000o',
	scope: null,
	config: { apiKey: API_KEY, webhookSecret: SECRET, fromAddress: 'team@acme.test' }
};

/** A recorded HTTP exchange: what the plugin asked Resend, and what it answered. */
function recorder(routes: Record<string, { status?: number; body: unknown }>) {
	const calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: unknown }> = [];
	const fetcher: FetchLike = async (url, init) => {
		const headers = (init.headers ?? {}) as Record<string, string>;
		calls.push({
			url,
			method: String(init.method),
			headers,
			...(init.body ? { body: JSON.parse(String(init.body)) } : {})
		});
		const route = routes[`${init.method} ${url}`];
		if (!route) return new Response(JSON.stringify({ name: 'not_found', message: 'no route' }), { status: 404 });
		const body = Buffer.isBuffer(route.body) ? route.body : JSON.stringify(route.body);
		return new Response(body as never, { status: route.status ?? 200 });
	};
	return { calls, fetcher };
}

function webhook(
	body: unknown,
	secret = SECRET,
	id = 'msg_2Lh9fixture',
	timestamp = String(Math.floor(Date.now() / 1000))
) {
	const raw = JSON.stringify(body);
	return {
		headers: {
			'svix-id': id,
			'svix-timestamp': timestamp,
			'svix-signature': `v1,${svixSignature(secret, id, timestamp, raw)}`
		},
		body,
		rawBody: Buffer.from(raw),
		query: {},
		url: `/api/inbox/inbound/resend/${account.id}`
	};
}

describe('Resend email provider', () => {
	describe('switch', () => {
		it('is on only for the exact value true, and warns once for any other value', () => {
			const warn = jest.fn();
			expect(isResendEnabled({}, warn)).toBe(false);
			expect(isResendEnabled({ EMAIL_PROVIDER_RESEND_ENABLED: 'false' }, warn)).toBe(false);
			expect(isResendEnabled({ EMAIL_PROVIDER_RESEND_ENABLED: 'true' }, warn)).toBe(true);
			expect(warn).not.toHaveBeenCalled();
			expect(isResendEnabled({ EMAIL_PROVIDER_RESEND_ENABLED: 'TRUE' }, warn)).toBe(false);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(String(warn.mock.calls[0]?.[0])).not.toContain('TRUE');
		});
	});

	describe('webhook signature (Svix)', () => {
		const provider = () => new ResendProvider();

		it('accepts a request signed with the account secret, named by its svix-id and timestamp', async () => {
			const request = webhook(EMAIL_RECEIVED_EVENT);
			const identity = await provider().verify(request, account);
			expect(identity.fingerprint).toBe(`${request.headers['svix-id']}.${request.headers['svix-timestamp']}`);
			expect(identity.ttlMs).toBeGreaterThanOrEqual(10 * 60 * 1000);
		});

		it('refuses an unsigned request, a forged one, a stale one and a changed body', async () => {
			const resend = provider();
			const signed = webhook(EMAIL_RECEIVED_EVENT);
			await expect(resend.verify({ ...signed, headers: {} }, account)).rejects.toBeInstanceOf(
				UnauthorizedException
			);
			await expect(
				resend.verify(webhook(EMAIL_RECEIVED_EVENT, `whsec_${Buffer.alloc(24, 6).toString('base64')}`), account)
			).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(
				resend.verify(
					webhook(EMAIL_RECEIVED_EVENT, SECRET, 'msg_old', String(Math.floor(Date.now() / 1000) - 3600)),
					account
				)
			).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(
				resend.verify(
					{ ...signed, rawBody: Buffer.from(JSON.stringify({ ...EMAIL_RECEIVED_EVENT, type: 'x' })) },
					account
				)
			).rejects.toBeInstanceOf(UnauthorizedException);
		});

		it('names a retry Resend re-signed (same svix-id, new timestamp) as another delivery', async () => {
			const resend = provider();
			const now = Math.floor(Date.now() / 1000);
			const first = await resend.verify(
				webhook(EMAIL_RECEIVED_EVENT, SECRET, 'msg_retry', String(now - 10)),
				account
			);
			const retry = await resend.verify(webhook(EMAIL_RECEIVED_EVENT, SECRET, 'msg_retry', String(now)), account);
			expect(retry.fingerprint).not.toBe(first.fingerprint);
		});

		it('refuses everything when the account has no webhook secret (no unsigned mode)', async () => {
			await expect(
				provider().verify(webhook(EMAIL_RECEIVED_EVENT), { ...account, config: { apiKey: API_KEY } })
			).rejects.toBeInstanceOf(UnauthorizedException);
		});

		it('accepts any of several v1 signatures (a secret rotation) and nothing malformed', () => {
			const body = '{"a":1}';
			const now = Math.floor(Date.now() / 1000);
			const good = svixSignature(SECRET, 'id1', String(now), body);
			expect(
				verifySvixSignature(
					SECRET,
					{ id: 'id1', timestamp: String(now), signature: `v1,bogus v1,${good}` },
					body
				)
			).toBe(true);
			expect(verifySvixSignature(SECRET, { id: 'id1', timestamp: 'soon', signature: `v1,${good}` }, body)).toBe(
				false
			);
			expect(
				verifySvixSignature(
					'not-a-secret',
					{ id: 'id1', timestamp: String(now), signature: `v1,${good}` },
					body
				)
			).toBe(false);
		});
	});

	describe('parse (recorded payloads)', () => {
		it('fetches the received email and its attachments from the Receiving API', async () => {
			const { calls, fetcher } = recorder({
				[`GET https://api.resend.com/emails/receiving/${RECEIVED_EMAIL_ID}`]: { body: RECEIVED_EMAIL },
				[`GET https://api.resend.com/emails/receiving/${RECEIVED_EMAIL_ID}/attachments`]: {
					body: RECEIVED_ATTACHMENTS
				},
				[`GET ${ATTACHMENT_URL}`]: { body: Buffer.from('%PDF-1.4 test') }
			});
			const [message] = await new ResendProvider(undefined, fetcher).parse(
				webhook(EMAIL_RECEIVED_EVENT),
				account
			);

			expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
				`GET https://api.resend.com/emails/receiving/${RECEIVED_EMAIL_ID}`,
				`GET https://api.resend.com/emails/receiving/${RECEIVED_EMAIL_ID}/attachments`,
				`GET ${ATTACHMENT_URL}`
			]);
			expect(calls[0]?.headers['Authorization']).toBe(`Bearer ${API_KEY}`);
			// The signed download URL carries its own authorization: the API key never goes there.
			expect(calls[2]?.headers['Authorization']).toBeUndefined();

			expect(message?.messageId).toBe('<m-2@acme.test>');
			expect(message?.providerMessageId).toBe(RECEIVED_EMAIL_ID);
			expect(message?.from).toEqual({ address: 'ada@acme.test', name: 'Ada Lovelace' });
			expect(message?.envelopeRecipients).toEqual(['support.ever@inbox.example.test']);
			expect(message?.cc).toEqual([{ address: 'bob@acme.test', name: 'Bob' }]);
			expect(message?.inReplyTo).toBe('<m-1@acme.test>');
			expect(message?.references).toEqual(['<m-0@acme.test>', '<m-1@acme.test>']);
			expect(message?.text).toBe('Paid today.');
			// Sanitizing is the Inbox worker's job: the HTML arrives as Resend gave it.
			expect(message?.html).toContain('onclick');
			expect(message?.attachments).toHaveLength(1);
			expect(message?.attachments[0]).toMatchObject({
				filename: 'receipt.pdf',
				contentType: 'application/pdf',
				size: 13
			});
		});

		it('ignores events that carry no received mail', async () => {
			const { calls, fetcher } = recorder({});
			const resend = new ResendProvider(undefined, fetcher);
			expect(await resend.parse(webhook({ type: 'email.delivered', data: { email_id: 'x' } }), account)).toEqual(
				[]
			);
			expect(calls).toHaveLength(0);
		});

		it('keeps one byte budget for all attachments of a message', async () => {
			const big = Buffer.alloc(1024, 1);
			const { fetcher } = recorder({
				[`GET https://api.resend.com/emails/receiving/${RECEIVED_EMAIL_ID}`]: { body: RECEIVED_EMAIL },
				[`GET https://api.resend.com/emails/receiving/${RECEIVED_EMAIL_ID}/attachments`]: {
					body: RECEIVED_ATTACHMENTS
				},
				[`GET ${ATTACHMENT_URL}`]: { body: big }
			});
			const resend = new ResendProvider(undefined, fetcher);
			const download = jest.spyOn(ResendApiClient.prototype, 'download');
			try {
				await resend.parse(webhook(EMAIL_RECEIVED_EVENT), account);
				expect(download).toHaveBeenCalledWith(ATTACHMENT_URL, RESEND_MAX_DOWNLOAD_BYTES);
			} finally {
				download.mockRestore();
			}
		});

		it('refuses a download URL to a private address', async () => {
			const { fetcher } = recorder({
				[`GET https://api.resend.com/emails/receiving/${RECEIVED_EMAIL_ID}`]: {
					body: { ...RECEIVED_EMAIL, raw: { download_url: 'https://127.0.0.1/raw.eml' } }
				}
			});
			await expect(
				new ResendProvider(undefined, fetcher).parse(webhook(EMAIL_RECEIVED_EVENT), account)
			).rejects.toThrow(/not allowed/);
		});
	});

	describe('outbound transport', () => {
		it('quotes a display name with a special character, so a comma never splits the address', () => {
			expect(displayName('Support')).toBe('Support');
			expect(displayName('Support, Europe')).toBe('"Support, Europe"');
			expect(displayName('A "Q" \\ B')).toBe('"A \\"Q\\" \\\\ B"');
		});

		it('sends through POST /emails with the threading headers, attachments and an idempotency key', async () => {
			const { calls, fetcher } = recorder({
				'POST https://api.resend.com/emails': { body: { id: 'resend-id-1' } }
			});
			const transport = new ResendProvider(undefined, fetcher).createTransport(account) as {
				send(mail: unknown, callback: (error: Error | null, info?: Record<string, unknown>) => void): void;
			};
			const mail = {
				data: {
					subject: 'Re: Invoice 42',
					text: 'Thanks!',
					inReplyTo: '<m-2@acme.test>',
					references: ['<m-1@acme.test>', '<m-2@acme.test>'],
					attachments: [{ filename: 'a.txt', content: Buffer.from('x'), contentType: 'text/plain' }]
				},
				message: {
					messageId: () => '<out-1@inbox.example.test>',
					getAddresses: () => ({
						from: [{ address: 'support.ever@inbox.example.test', name: 'Support' }],
						to: [{ address: 'ada@acme.test' }],
						cc: [{ address: 'bob@acme.test' }]
					})
				},
				resolveContent: (
					target: Record<string, unknown>,
					key: string,
					callback: (e: Error | null, v?: unknown) => void
				) => callback(null, target[key])
			};
			const info = await new Promise<Record<string, unknown>>((resolve, reject) =>
				transport.send(mail, (error, result) =>
					error ? reject(error) : resolve(result as Record<string, unknown>)
				)
			);
			expect(info['response']).toBe('resend:resend-id-1');
			expect(info['providerMessageId']).toBe('resend-id-1');
			expect(info['messageId']).toBe('<out-1@inbox.example.test>');
			const call = calls[0] as { headers: Record<string, string>; body: Record<string, unknown> };
			expect(call.headers['Idempotency-Key']).toBe('<out-1@inbox.example.test>');
			expect(call.body).toEqual({
				from: 'Support <support.ever@inbox.example.test>',
				to: ['ada@acme.test'],
				cc: ['bob@acme.test'],
				subject: 'Re: Invoice 42',
				text: 'Thanks!',
				headers: {
					'Message-ID': '<out-1@inbox.example.test>',
					'In-Reply-To': '<m-2@acme.test>',
					References: '<m-1@acme.test> <m-2@acme.test>'
				},
				attachments: [
					{ filename: 'a.txt', content: Buffer.from('x').toString('base64'), content_type: 'text/plain' }
				]
			});
		});
	});

	describe('connection test', () => {
		it('reports the verified domains, and a refused key', async () => {
			const ok = recorder({ 'GET https://api.resend.com/domains': { body: DOMAINS } });
			expect(await new ResendProvider(undefined, ok.fetcher).verifyAccount(account)).toMatchObject({
				ok: true,
				details: { verifiedDomains: ['acme.test'] }
			});
			const refused = recorder({
				'GET https://api.resend.com/domains': {
					status: 401,
					body: { name: 'validation_error', message: 'API key is invalid' }
				}
			});
			expect(await new ResendProvider(undefined, refused.fetcher).verifyAccount(account)).toEqual({
				ok: false,
				message: 'Resend refused the API key.'
			});
			const restricted = recorder({
				'GET https://api.resend.com/domains': {
					status: 401,
					body: { name: 'restricted_api_key', message: 'restricted' }
				}
			});
			expect((await new ResendProvider(undefined, restricted.fetcher).verifyAccount(account)).ok).toBe(true);
		});
	});

	it('registers with the Inbox email provider registry, and stays idle without it', () => {
		const registry = { register: jest.fn(), unregister: jest.fn(), get: jest.fn(), list: jest.fn() };
		const resend = new ResendProvider(registry);
		resend.onModuleInit();
		expect(registry.register).toHaveBeenCalledWith(resend);
		expect(() => new ResendProvider().onModuleInit()).not.toThrow();
	});
});
