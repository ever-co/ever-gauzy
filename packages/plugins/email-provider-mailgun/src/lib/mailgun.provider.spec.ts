// cspell:ignore dmarc
// `@gauzy/plugin-inbox` from source with its real MIME parser, form reader and outbound helper; `@gauzy/core` (whose
// barrel boots the application) is not needed by the parts used here.
jest.mock('@gauzy/core', () => ({}));
jest.mock('@gauzy/plugin-inbox', () => ({
	...jest.requireActual('../../../inbox/src/lib/email/inbound/mime'),
	...jest.requireActual('../../../inbox/src/lib/email/providers/outbound-mail'),
	...jest.requireActual('../../../inbox/src/lib/email/providers/form-body')
}));

import { createHmac } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { isMailgunEnabled } from './mailgun-enabled';
import { MailgunFetch, MailgunProvider } from './mailgun.provider';
import { PARSED_ROUTE_FIELDS, RAW_MIME } from './testing/mailgun-payloads';

const SIGNING_KEY = 'fixture-signing-key';
const account = {
	id: 'a0000000-0000-4000-8000-00000000000a',
	providerId: 'mailgun',
	tenantId: 't0000000-0000-4000-8000-00000000000t',
	organizationId: 'o0000000-0000-4000-8000-00000000000o',
	scope: null,
	config: {
		webhookSigningKey: SIGNING_KEY,
		apiKey: `key-${'x'.repeat(8)}`,
		domain: 'mg.acme.test',
		fromAddress: 'team@mg.acme.test'
	}
};

/** The signature fields Mailgun adds to every POST. */
function signed(fields: Record<string, string>, at = Math.floor(Date.now() / 1000), token = 'a'.repeat(50)) {
	const timestamp = String(at);
	const signature = createHmac('sha256', SIGNING_KEY).update(`${timestamp}${token}`).digest('hex');
	return { ...fields, timestamp, token, signature };
}

/** A URL-encoded route POST, as the API hands it over (parsed fields, raw bytes). */
function urlencoded(fields: Record<string, string>) {
	return {
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: fields,
		rawBody: Buffer.from(new URLSearchParams(fields).toString()),
		query: {},
		url: `/api/inbox/inbound/mailgun/${account.id}`
	};
}

/** A multipart route POST (with files), as the Inbox's webhook route keeps it (raw bytes, no parsed body). */
async function multipart(fields: Record<string, string>, files: Array<[string, string, string, Buffer]> = []) {
	const form = new FormData();
	for (const [name, value] of Object.entries(fields)) form.append(name, value);
	for (const [name, filename, type, content] of files) {
		form.append(name, new Blob([new Uint8Array(content)], { type }), filename);
	}
	const encoded = new Request('http://localhost/', { method: 'POST', body: form });
	return {
		headers: { 'content-type': encoded.headers.get('content-type') as string },
		body: {},
		rawBody: Buffer.from(await encoded.arrayBuffer()),
		query: {},
		url: `/api/inbox/inbound/mailgun/${account.id}`
	};
}

describe('Mailgun email provider', () => {
	it('is on only for the exact value true', () => {
		const warn = jest.fn();
		expect(isMailgunEnabled({}, warn)).toBe(false);
		expect(isMailgunEnabled({ EMAIL_PROVIDER_MAILGUN_ENABLED: 'true' }, warn)).toBe(true);
		expect(isMailgunEnabled({ EMAIL_PROVIDER_MAILGUN_ENABLED: '1' }, warn)).toBe(false);
		expect(warn).toHaveBeenCalledTimes(1);
	});

	describe('verify (webhook signing key)', () => {
		const provider = new MailgunProvider();

		it('accepts a signed route POST and names the delivery by its token', async () => {
			const identity = await provider.verify(urlencoded(signed(PARSED_ROUTE_FIELDS)), account);
			expect(identity.fingerprint).toMatch(/^token:[0-9a-f]{64}$/);
			expect(identity.ttlMs).toBeGreaterThan(15 * 60 * 1000);
			// A multipart POST carries the same fields.
			const form = await multipart(signed(PARSED_ROUTE_FIELDS, undefined, 'b'.repeat(50)));
			expect((await provider.verify(form, account)).fingerprint).not.toBe(identity.fingerprint);
		});

		it('refuses an unsigned POST, another key, a stale timestamp, and an account without a key', async () => {
			await expect(provider.verify(urlencoded(PARSED_ROUTE_FIELDS), account)).rejects.toBeInstanceOf(
				UnauthorizedException
			);
			const forged = { ...signed(PARSED_ROUTE_FIELDS), signature: 'f'.repeat(64) };
			await expect(provider.verify(urlencoded(forged), account)).rejects.toBeInstanceOf(UnauthorizedException);
			const stale = signed(PARSED_ROUTE_FIELDS, Math.floor(Date.now() / 1000) - 16 * 60);
			await expect(provider.verify(urlencoded(stale), account)).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(
				provider.verify(urlencoded(signed(PARSED_ROUTE_FIELDS)), { ...account, config: { apiKey: 'x' } })
			).rejects.toBeInstanceOf(UnauthorizedException);
		});
	});

	describe('parse (recorded payloads)', () => {
		it('maps a parsed route POST, trusting only the verdicts Mailgun adds', async () => {
			const request = await multipart(signed(PARSED_ROUTE_FIELDS), [
				['attachment-1', 'receipt.pdf', 'application/pdf', Buffer.from('%PDF-1.4 test')],
				['attachment-2', 'logo.png', 'image/png', Buffer.from('png')]
			]);
			const [message] = await new MailgunProvider().parse(request);
			expect(message?.messageId).toBe('<m-2@acme.test>');
			expect(message?.from).toEqual({ address: 'ada@acme.test', name: 'Lovelace, Ada' });
			expect(message?.to).toEqual([{ address: 'support.ever@inbox.example.test' }]);
			expect(message?.cc).toEqual([{ address: 'bob@acme.test', name: 'Bob' }]);
			expect(message?.replyTo).toEqual([{ address: 'ada+billing@acme.test', name: 'Ada' }]);
			expect(message?.envelopeRecipients).toEqual(['support.ever@inbox.example.test']);
			expect(message?.envelopeFrom).toBe('bounce+ada@acme.test');
			expect(message?.inReplyTo).toBe('<m-1@acme.test>');
			expect(message?.references).toEqual(['<m-0@acme.test>', '<m-1@acme.test>']);
			expect([message?.spf, message?.dkim, message?.spamScore]).toEqual(['pass', 'pass', 0.3]);
			// The message's own Authentication-Results is the sender's claim: no DMARC verdict from it.
			expect(message?.dmarc).toBeUndefined();
			expect(
				message?.attachments.map((part) => [part.filename, part.size, part.isInline, part.contentId])
			).toEqual([
				['receipt.pdf', 13, false, undefined],
				['logo.png', 3, true, 'logo@acme.test']
			]);
		});

		it('parses the raw message of a URL ending in mime', async () => {
			const [message] = await new MailgunProvider().parse(
				urlencoded(signed({ recipient: 'support.ever@inbox.example.test', 'body-mime': RAW_MIME }))
			);
			expect(message?.messageId).toBe('<raw-1@b.test>');
			expect(message?.envelopeRecipients).toEqual(['support.ever@inbox.example.test']);
		});

		it('derives the same Message-ID on a retry (new signature, new boundary)', async () => {
			const { ['Message-Id']: _id, ...withoutId } = PARSED_ROUTE_FIELDS;
			const headerless = { ...withoutId, 'message-headers': '[]' };
			const [first] = await new MailgunProvider().parse(await multipart(signed(headerless)));
			const [retry] = await new MailgunProvider().parse(
				await multipart(signed(headerless, Math.floor(Date.now() / 1000) + 5, 'c'.repeat(50)))
			);
			expect(first?.messageId).toMatch(/^<[0-9a-f]{40}@/);
			expect(retry?.messageId).toBe(first?.messageId);
		});
	});

	describe('outbound transport and connection test', () => {
		function recorder(answers: Record<string, { status?: number; body: unknown }>) {
			const calls: Array<{ url: string; init: RequestInit }> = [];
			const fetcher: MailgunFetch = async (url, init) => {
				calls.push({ url, init });
				const answer = answers[`${init.method} ${url}`] ?? { status: 404, body: { message: 'not found' } };
				return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
			};
			return { calls, fetcher };
		}

		it('sends through POST /v3/<domain>/messages with the threading headers and attachments', async () => {
			const { calls, fetcher } = recorder({
				'POST https://api.mailgun.net/v3/mg.acme.test/messages': {
					body: { id: '<mg-1@mg.acme.test>', message: 'Queued. Thank you.' }
				}
			});
			const transport = new MailgunProvider(undefined, fetcher).createTransport(account) as {
				send(mail: unknown, callback: (error: Error | null, info?: Record<string, unknown>) => void): void;
			};
			const mail = {
				data: {
					subject: 'Re: Invoice 42',
					text: 'Thanks!',
					inReplyTo: '<m-2@acme.test>',
					references: ['<m-1@acme.test>', '<m-2@acme.test>'],
					attachments: [
						{ filename: 'a.txt', content: Buffer.from('x'), contentType: 'text/plain' },
						{ filename: 'logo.png', content: Buffer.from('png'), contentType: 'image/png', cid: 'logo1' }
					]
				},
				message: {
					messageId: () => '<out-1@mg.acme.test>',
					getAddresses: () => ({
						from: [{ address: 'support.ever@inbox.example.test', name: 'Support' }],
						to: [{ address: 'ada@acme.test' }, { address: 'bob@acme.test', name: 'Bob' }]
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
			expect(info['response']).toBe('mailgun:<mg-1@mg.acme.test>');
			const call = calls[0] as { init: RequestInit };
			expect((call.init.headers as Record<string, string>)['Authorization']).toBe(
				`Basic ${Buffer.from(`api:${account.config.apiKey}`).toString('base64')}`
			);
			const form = call.init.body as FormData;
			expect(form.get('from')).toBe('Support <support.ever@inbox.example.test>');
			expect(form.getAll('to')).toEqual(['ada@acme.test', 'Bob <bob@acme.test>']);
			expect(form.get('subject')).toBe('Re: Invoice 42');
			expect(form.get('text')).toBe('Thanks!');
			expect(form.get('h:Message-ID')).toBe('<out-1@mg.acme.test>');
			expect(form.get('h:In-Reply-To')).toBe('<m-2@acme.test>');
			expect(form.get('h:References')).toBe('<m-1@acme.test> <m-2@acme.test>');
			expect((form.get('attachment') as File).name).toBe('a.txt');
			expect((form.get('inline') as File).name).toBe('logo1');
		});

		it('reports the domain, a refused key, and uses the EU region when set', async () => {
			const ok = recorder({
				'GET https://api.mailgun.net/v3/domains/mg.acme.test': {
					body: { domain: { name: 'mg.acme.test', state: 'active' } }
				}
			});
			expect(await new MailgunProvider(undefined, ok.fetcher).verifyAccount(account)).toEqual({
				ok: true,
				message: 'Connected: the Mailgun domain mg.acme.test is active.'
			});
			const refused = recorder({
				'GET https://api.mailgun.net/v3/domains/mg.acme.test': { status: 401, body: { message: 'Forbidden' } }
			});
			expect(await new MailgunProvider(undefined, refused.fetcher).verifyAccount(account)).toEqual({
				ok: false,
				message: 'Mailgun refused the API key.'
			});
			const eu = recorder({
				'GET https://api.eu.mailgun.net/v3/domains/mg.acme.test': {
					body: { domain: { name: 'mg.acme.test', state: 'unverified' } }
				}
			});
			expect(
				await new MailgunProvider(undefined, eu.fetcher).verifyAccount({
					...account,
					config: { ...account.config, region: 'eu' }
				})
			).toEqual({
				ok: false,
				message: 'The Mailgun domain mg.acme.test is unverified: finish its DNS setup in Mailgun.'
			});
		});
	});
});
