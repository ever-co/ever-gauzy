// cspell:ignore dmarc
// `@gauzy/plugin-inbox` from source with its real MIME parser and outbound helper; `@gauzy/core` (whose barrel boots
// the application) is not needed by the parts used here.
jest.mock('@gauzy/core', () => ({}));
jest.mock('@gauzy/plugin-inbox', () => ({
	...jest.requireActual('../../../inbox/src/lib/email/inbound/mime'),
	...jest.requireActual('../../../inbox/src/lib/email/providers/outbound-mail')
}));

import { UnauthorizedException } from '@nestjs/common';
import { isPostmarkEnabled } from './postmark-enabled';
import { formatAddress } from '../../../inbox/src/lib/email/providers/outbound-mail';
import { PostmarkFetch, PostmarkProvider } from './postmark.provider';

const account = {
	id: 'a0000000-0000-4000-8000-00000000000a',
	providerId: 'postmark',
	tenantId: 't0000000-0000-4000-8000-00000000000t',
	organizationId: 'o0000000-0000-4000-8000-00000000000o',
	scope: null,
	config: {
		serverToken: 'server-token-fixture',
		webhookUser: 'u_fixture_user',
		webhookPassword: 'p_fixture_password_0123456789',
		fromAddress: 'team@acme.test'
	}
};

/** Postmark's inbound webhook body, in the shape of its documented inbound JSON (fixture values). */
const INBOUND = {
	FromName: 'Ada Lovelace',
	MessageStream: 'inbound',
	From: 'ada@acme.test',
	FromFull: { Email: 'ada@acme.test', Name: 'Ada Lovelace', MailboxHash: '' },
	To: 'support.ever@inbox.example.test',
	ToFull: [{ Email: 'support.ever@inbox.example.test', Name: '', MailboxHash: '' }],
	Cc: 'Bob <bob@acme.test>',
	CcFull: [{ Email: 'bob@acme.test', Name: 'Bob', MailboxHash: '' }],
	BccFull: [],
	OriginalRecipient: 'support.ever@inbox.example.test',
	Subject: 'Re: Invoice 42',
	MessageID: '73e6d360-66eb-11e1-8e72-a8904824019b',
	ReplyTo: '',
	MailboxHash: '',
	Date: 'Fri, 16 Oct 2026 10:00:00 +0000',
	TextBody: 'Paid today.',
	HtmlBody: '<p>Paid <b>today</b>.</p>',
	StrippedTextReply: 'Paid today.',
	Tag: '',
	Headers: [
		{ Name: 'X-Spam-Checker-Version', Value: 'SpamAssassin 3.3.1' },
		{ Name: 'X-Spam-Score', Value: '-0.1' },
		{ Name: 'Received-SPF', Value: 'Pass (sender SPF authorized) identity=mailfrom; client-ip=203.0.113.5' },
		{ Name: 'Authentication-Results', Value: 'forged.example; dmarc=pass' },
		{ Name: 'Message-ID', Value: '<m-2@acme.test>' },
		{ Name: 'In-Reply-To', Value: '<m-1@acme.test>' },
		{ Name: 'References', Value: '<m-0@acme.test> <m-1@acme.test>' }
	],
	Attachments: [
		{
			Name: 'receipt.pdf',
			Content: Buffer.from('%PDF-1.4 test').toString('base64'),
			ContentType: 'application/pdf',
			ContentLength: 13,
			ContentID: ''
		}
	]
};

function request(body: unknown, credential?: string) {
	const raw = JSON.stringify(body);
	return {
		headers:
			credential === undefined ? {} : { authorization: `Basic ${Buffer.from(credential).toString('base64')}` },
		body,
		rawBody: Buffer.from(raw),
		query: {},
		url: `/api/inbox/inbound/postmark/${account.id}`
	};
}

const valid = `${account.config.webhookUser}:${account.config.webhookPassword}`;

describe('Postmark email provider', () => {
	it('is on only for the exact value true', () => {
		const warn = jest.fn();
		expect(isPostmarkEnabled({}, warn)).toBe(false);
		expect(isPostmarkEnabled({ EMAIL_PROVIDER_POSTMARK_ENABLED: 'true' }, warn)).toBe(true);
		expect(isPostmarkEnabled({ EMAIL_PROVIDER_POSTMARK_ENABLED: 'yes' }, warn)).toBe(false);
		expect(warn).toHaveBeenCalledTimes(1);
	});

	describe('verify (Basic-auth credential)', () => {
		const provider = new PostmarkProvider();

		it("accepts the account's credential and names the delivery by Postmark's message id", async () => {
			expect(await provider.verify(request(INBOUND, valid), account)).toEqual({
				fingerprint: `id:${INBOUND.MessageID}`,
				ttlMs: 60 * 60 * 1000
			});
		});

		it('refuses an unsigned request, another credential, and an account without one', async () => {
			await expect(provider.verify(request(INBOUND), account)).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(
				provider.verify(request(INBOUND, `${account.config.webhookUser}:wrong`), account)
			).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(
				provider.verify(request(INBOUND, valid), { ...account, config: { serverToken: 'x' } })
			).rejects.toBeInstanceOf(UnauthorizedException);
		});

		it('builds the webhook URL with the credential', () => {
			expect(provider.webhookUrl('https://api.example.test/api/inbox/inbound/postmark/a1', account)).toBe(
				`https://${account.config.webhookUser}:${account.config.webhookPassword}@api.example.test/api/inbox/inbound/postmark/a1`
			);
		});
	});

	describe('parse (recorded payload)', () => {
		it('maps the inbound JSON, trusting only the verdicts Postmark adds', async () => {
			const [message] = await new PostmarkProvider().parse(request(INBOUND, valid));
			expect(message?.messageId).toBe('<m-2@acme.test>');
			expect(message?.providerMessageId).toBe(INBOUND.MessageID);
			expect(message?.from).toEqual({ address: 'ada@acme.test', name: 'Ada Lovelace' });
			expect(message?.to).toEqual([{ address: 'support.ever@inbox.example.test' }]);
			expect(message?.cc).toEqual([{ address: 'bob@acme.test', name: 'Bob' }]);
			expect(message?.envelopeRecipients).toEqual(['support.ever@inbox.example.test']);
			expect(message?.inReplyTo).toBe('<m-1@acme.test>');
			expect(message?.references).toEqual(['<m-0@acme.test>', '<m-1@acme.test>']);
			expect(message?.spf).toBe('pass');
			expect(message?.spamScore).toBe(-0.1);
			// The message's own Authentication-Results is the sender's claim: no DMARC verdict from it.
			expect(message?.dmarc).toBeUndefined();
			expect(message?.attachments[0]).toMatchObject({ filename: 'receipt.pdf', size: 13, isInline: false });
		});

		it('parses RawEmail as MIME when the stream includes it', async () => {
			const raw =
				'From: a@b.test\r\nTo: support.ever@inbox.example.test\r\nMessage-ID: <raw-1@b.test>\r\nSubject: hi\r\n\r\nbody\r\n';
			const [message] = await new PostmarkProvider().parse(request({ ...INBOUND, RawEmail: raw }, valid));
			expect(message?.messageId).toBe('<raw-1@b.test>');
			expect(message?.raw?.toString()).toBe(raw);
		});
	});

	describe('outbound transport and connection test', () => {
		it('quotes a display name with a special character, so a comma never splits the address', () => {
			expect(formatAddress({ address: 'a@b.test', name: 'Support' })).toBe('Support <a@b.test>');
			expect(formatAddress({ address: 'a@b.test', name: 'Support, Europe' })).toBe(
				'"Support, Europe" <a@b.test>'
			);
			expect(formatAddress({ address: 'a@b.test', name: 'A "Q"' })).toBe('"A \\"Q\\"" <a@b.test>');
		});

		function recorder(answers: Record<string, { status?: number; body: unknown }>) {
			const calls: Array<{ url: string; init: RequestInit }> = [];
			const fetcher: PostmarkFetch = async (url, init) => {
				calls.push({ url, init });
				const answer = answers[`${init.method} ${url}`] ?? {
					status: 404,
					body: { ErrorCode: 404, Message: 'no route' }
				};
				return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
			};
			return { calls, fetcher };
		}

		it('sends through POST /email with the threading headers and attachments', async () => {
			const { calls, fetcher } = recorder({
				'POST https://api.postmarkapp.com/email': { body: { ErrorCode: 0, Message: 'OK', MessageID: 'pm-1' } }
			});
			const transport = new PostmarkProvider(undefined, fetcher).createTransport(account) as {
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
						to: [{ address: 'ada@acme.test' }]
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
			expect(info['response']).toBe('postmark:pm-1');
			const call = calls[0] as { init: RequestInit };
			expect((call.init.headers as Record<string, string>)['X-Postmark-Server-Token']).toBe(
				'server-token-fixture'
			);
			expect(JSON.parse(String(call.init.body))).toEqual({
				From: 'Support <support.ever@inbox.example.test>',
				To: 'ada@acme.test',
				Subject: 'Re: Invoice 42',
				TextBody: 'Thanks!',
				Headers: [
					{ Name: 'Message-ID', Value: '<out-1@inbox.example.test>' },
					{ Name: 'In-Reply-To', Value: '<m-2@acme.test>' },
					{ Name: 'References', Value: '<m-1@acme.test> <m-2@acme.test>' }
				],
				Attachments: [
					{ Name: 'a.txt', Content: Buffer.from('x').toString('base64'), ContentType: 'text/plain' }
				],
				MessageStream: 'outbound'
			});
		});

		it('reports the server, and a refused token', async () => {
			const ok = recorder({ 'GET https://api.postmarkapp.com/server': { body: { Name: 'Gauzy inbox' } } });
			expect(await new PostmarkProvider(undefined, ok.fetcher).verifyAccount(account)).toEqual({
				ok: true,
				message: 'Connected to the Postmark server "Gauzy inbox".'
			});
			const refused = recorder({
				'GET https://api.postmarkapp.com/server': {
					status: 401,
					body: { ErrorCode: 10, Message: 'Bad or missing API token' }
				}
			});
			expect(await new PostmarkProvider(undefined, refused.fetcher).verifyAccount(account)).toEqual({
				ok: false,
				message: 'Postmark refused the server token.'
			});
		});
	});
});
