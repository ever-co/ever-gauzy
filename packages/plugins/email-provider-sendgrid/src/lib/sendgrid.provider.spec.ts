// cspell:ignore dmarc softfail
// `@gauzy/plugin-inbox` from source with its real MIME parser, form reader and outbound helper; `@gauzy/core` (whose
// barrel boots the application) is not needed by the parts used here.
jest.mock('@gauzy/core', () => ({}));
jest.mock('@gauzy/plugin-inbox', () => ({
	...jest.requireActual('../../../inbox/src/lib/email/inbound/mime'),
	...jest.requireActual('../../../inbox/src/lib/email/providers/outbound-mail'),
	...jest.requireActual('../../../inbox/src/lib/email/providers/form-body')
}));

import { createSign, generateKeyPairSync } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { isSendGridEnabled } from './sendgrid-enabled';
import {
	SENDGRID_SIGNATURE_HEADER,
	SENDGRID_TIMESTAMP_HEADER,
	SendGridFetch,
	SendGridProvider,
	verificationKeyOf
} from './sendgrid.provider';
import { PARSED_FIELDS, RAW_MIME } from './testing/sendgrid-payloads';

// A key pair made for this run: SendGrid signs with its private key, the account keeps the public one.
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const VERIFICATION_KEY = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

const account = {
	id: 'a0000000-0000-4000-8000-00000000000a',
	providerId: 'sendgrid',
	tenantId: 't0000000-0000-4000-8000-00000000000t',
	organizationId: 'o0000000-0000-4000-8000-00000000000o',
	scope: null,
	config: { verificationKey: VERIFICATION_KEY, apiKey: `SG.${'x'.repeat(8)}`, fromAddress: 'team@acme.test' }
};

/** An Inbound Parse POST: a multipart form, kept raw by the Inbox's webhook route, signed when `sign` is set. */
async function post(
	fields: Record<string, string>,
	files: Array<[string, string, string, Buffer]> = [],
	sign: { at?: number; key?: typeof privateKey } | false = {}
) {
	const form = new FormData();
	for (const [name, value] of Object.entries(fields)) form.append(name, value);
	for (const [name, filename, type, content] of files) {
		form.append(name, new Blob([new Uint8Array(content)], { type }), filename);
	}
	const encoded = new Request('http://localhost/', { method: 'POST', body: form });
	const rawBody = Buffer.from(await encoded.arrayBuffer());
	const headers: Record<string, string> = { 'content-type': encoded.headers.get('content-type') as string };
	if (sign) {
		const timestamp = String(sign.at ?? Math.floor(Date.now() / 1000));
		headers[SENDGRID_TIMESTAMP_HEADER] = timestamp;
		headers[SENDGRID_SIGNATURE_HEADER] = createSign('sha256')
			.update(timestamp)
			.update(rawBody)
			.sign(sign.key ?? privateKey, 'base64');
	}
	return { headers, body: {}, rawBody, query: {}, url: `/api/inbox/inbound/sendgrid/${account.id}` };
}

describe('SendGrid email provider', () => {
	it('is on only for the exact value true', () => {
		const warn = jest.fn();
		expect(isSendGridEnabled({}, warn)).toBe(false);
		expect(isSendGridEnabled({ EMAIL_PROVIDER_SENDGRID_ENABLED: 'true' }, warn)).toBe(true);
		expect(isSendGridEnabled({ EMAIL_PROVIDER_SENDGRID_ENABLED: 'on' }, warn)).toBe(false);
		expect(warn).toHaveBeenCalledTimes(1);
	});

	describe('verify (signed Inbound Parse)', () => {
		const provider = new SendGridProvider();

		it('accepts a signed POST and names the delivery by its signature', async () => {
			const signed = await post(PARSED_FIELDS);
			const identity = await provider.verify(signed, account);
			expect(identity.fingerprint).toMatch(/^sig:[0-9a-f]{64}$/);
			expect(identity.ttlMs).toBeGreaterThan(15 * 60 * 1000);
			// The same signature re-encoded (whitespace in the base64) is the same delivery.
			const signature = signed.headers[SENDGRID_SIGNATURE_HEADER] as string;
			const reencoded = {
				...signed,
				headers: {
					...signed.headers,
					[SENDGRID_SIGNATURE_HEADER]: `${signature.slice(0, 8)} ${signature.slice(8)}`
				}
			};
			expect((await provider.verify(reencoded, account)).fingerprint).toBe(identity.fingerprint);
			// The key as PEM works too.
			const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
			expect(verificationKeyOf(pem)?.asymmetricKeyType).toBe('ec');
		});

		it('refuses an unsigned POST, another key, a changed body, a stale timestamp and no key', async () => {
			await expect(provider.verify(await post(PARSED_FIELDS, [], false), account)).rejects.toBeInstanceOf(
				UnauthorizedException
			);
			const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
			await expect(
				provider.verify(await post(PARSED_FIELDS, [], { key: other }), account)
			).rejects.toBeInstanceOf(UnauthorizedException);
			const changed = await post(PARSED_FIELDS);
			changed.rawBody = Buffer.concat([changed.rawBody, Buffer.from('x')]);
			await expect(provider.verify(changed, account)).rejects.toBeInstanceOf(UnauthorizedException);
			const stale = await post(PARSED_FIELDS, [], { at: Math.floor(Date.now() / 1000) - 16 * 60 });
			await expect(provider.verify(stale, account)).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(
				provider.verify(await post(PARSED_FIELDS), { ...account, config: { apiKey: 'x' } })
			).rejects.toBeInstanceOf(UnauthorizedException);
			expect(verificationKeyOf('not a key')).toBeNull();
		});
	});

	describe('parse (recorded payloads)', () => {
		it('maps a parsed POST, trusting only the checks SendGrid adds', async () => {
			const request = await post(PARSED_FIELDS, [
				['attachment1', 'receipt.pdf', 'application/pdf', Buffer.from('%PDF-1.4 test')],
				['attachment2', 'logo.png', 'image/png', Buffer.from('png')]
			]);
			const [message] = await new SendGridProvider().parse(request);
			expect(message?.messageId).toBe('<m-2@acme.test>');
			expect(message?.from).toEqual({ address: 'ada@acme.test', name: 'Lovelace, Ada' });
			expect(message?.to).toEqual([{ address: 'support.ever@inbox.example.test' }]);
			expect(message?.cc).toEqual([{ address: 'bob@acme.test', name: 'Bob' }]);
			expect(message?.replyTo).toEqual([{ address: 'ada+billing@acme.test', name: 'Ada' }]);
			expect(message?.envelopeRecipients).toEqual(['support.ever@inbox.example.test']);
			expect(message?.envelopeFrom).toBe('bounce@acme.test');
			expect(message?.inReplyTo).toBe('<m-1@acme.test>');
			// A folded References header.
			expect(message?.references).toEqual(['<m-0@acme.test>', '<m-1@acme.test>']);
			expect([message?.spf, message?.dkim, message?.spamScore]).toEqual(['pass', 'pass', 0.4]);
			// The message's own Authentication-Results is the sender's claim: no DMARC verdict from it.
			expect(message?.dmarc).toBeUndefined();
			expect(
				message?.attachments.map((part) => [part.filename, part.size, part.isInline, part.contentId])
			).toEqual([
				['receipt.pdf', 13, false, undefined],
				['logo.png', 3, true, 'logo@acme.test']
			]);
		});

		it('parses the raw message of a raw-MIME parse setting', async () => {
			const [message] = await new SendGridProvider().parse(
				await post({ email: RAW_MIME, envelope: PARSED_FIELDS['envelope'] as string, SPF: 'softfail' })
			);
			expect(message?.messageId).toBe('<raw-1@b.test>');
			expect(message?.envelopeRecipients).toEqual(['support.ever@inbox.example.test']);
			expect(message?.spf).toBe('softfail');
		});
	});

	describe('outbound transport and connection test', () => {
		function recorder(
			answers: Record<string, { status?: number; body?: unknown; headers?: Record<string, string> }>
		) {
			const calls: Array<{ url: string; init: RequestInit }> = [];
			const fetcher: SendGridFetch = async (url, init) => {
				calls.push({ url, init });
				const answer = answers[`${init.method} ${url}`] ?? {
					status: 404,
					body: { errors: [{ message: 'no route' }] }
				};
				return new Response(answer.body === undefined ? null : JSON.stringify(answer.body), {
					status: answer.status ?? 200,
					headers: answer.headers ?? {}
				});
			};
			return { calls, fetcher };
		}

		it('sends through POST /v3/mail/send with the threading headers and attachments', async () => {
			const { calls, fetcher } = recorder({
				'POST https://api.sendgrid.com/v3/mail/send': { status: 202, headers: { 'X-Message-Id': 'sg-1' } }
			});
			const transport = new SendGridProvider(undefined, fetcher).createTransport(account) as {
				send(mail: unknown, callback: (error: Error | null, info?: Record<string, unknown>) => void): void;
			};
			const mail = {
				data: {
					subject: 'Re: Invoice 42',
					text: 'Thanks!',
					html: '<p>Thanks!</p>',
					inReplyTo: '<m-2@acme.test>',
					references: ['<m-1@acme.test>', '<m-2@acme.test>'],
					attachments: [
						{ filename: 'a.txt', content: Buffer.from('x'), contentType: 'text/plain' },
						{ filename: 'logo.png', content: Buffer.from('png'), contentType: 'image/png', cid: 'logo1' }
					]
				},
				message: {
					messageId: () => '<out-1@acme.test>',
					getAddresses: () => ({
						from: [{ address: 'support.ever@inbox.example.test', name: 'Support, Europe' }],
						to: [{ address: 'ada@acme.test' }],
						'reply-to': [{ address: 'support.ever@inbox.example.test' }]
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
			expect(info['response']).toBe('sendgrid:sg-1');
			const call = calls[0] as { init: RequestInit };
			expect((call.init.headers as Record<string, string>)['Authorization']).toBe(
				`Bearer ${account.config.apiKey}`
			);
			expect(JSON.parse(String(call.init.body))).toEqual({
				personalizations: [{ to: [{ email: 'ada@acme.test' }] }],
				// JSON fields carry the name as is (no quoting needed).
				from: { email: 'support.ever@inbox.example.test', name: 'Support, Europe' },
				reply_to: { email: 'support.ever@inbox.example.test' },
				subject: 'Re: Invoice 42',
				content: [
					{ type: 'text/plain', value: 'Thanks!' },
					{ type: 'text/html', value: '<p>Thanks!</p>' }
				],
				headers: {
					'Message-ID': '<out-1@acme.test>',
					'In-Reply-To': '<m-2@acme.test>',
					References: '<m-1@acme.test> <m-2@acme.test>'
				},
				attachments: [
					{
						content: Buffer.from('x').toString('base64'),
						filename: 'a.txt',
						type: 'text/plain',
						disposition: 'attachment'
					},
					{
						content: Buffer.from('png').toString('base64'),
						filename: 'logo.png',
						type: 'image/png',
						disposition: 'inline',
						content_id: 'logo1'
					}
				]
			});
		});

		it('reports whether the key can send, a refused key, and uses the EU region when set', async () => {
			const ok = recorder({ 'GET https://api.sendgrid.com/v3/scopes': { body: { scopes: ['mail.send'] } } });
			expect(await new SendGridProvider(undefined, ok.fetcher).verifyAccount(account)).toEqual({
				ok: true,
				message: 'Connected: the SendGrid key can send mail.'
			});
			const refused = recorder({
				'GET https://api.sendgrid.com/v3/scopes': { status: 401, body: { errors: [{ message: 'denied' }] } }
			});
			expect(await new SendGridProvider(undefined, refused.fetcher).verifyAccount(account)).toEqual({
				ok: false,
				message: 'SendGrid refused the API key.'
			});
			const eu = recorder({
				'GET https://api.eu.sendgrid.com/v3/scopes': { body: { scopes: ['user.profile.read'] } }
			});
			expect(
				await new SendGridProvider(undefined, eu.fetcher).verifyAccount({
					...account,
					config: { ...account.config, region: 'eu' }
				})
			).toEqual({ ok: false, message: 'The SendGrid key cannot send mail (it lacks the Mail Send permission).' });
		});
	});
});
