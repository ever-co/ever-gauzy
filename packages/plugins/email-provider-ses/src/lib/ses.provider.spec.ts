// cspell:ignore dmarc AKID AKIDEXAMPLE AKIDX Jalr FEMI MDENG CYEXAMPLEKEY
// `@gauzy/plugin-inbox` from source with its real MIME parser and settings; `@gauzy/core` (whose barrel boots the
// application) is not needed by the parts used here.
jest.mock('@gauzy/core', () => ({}));
jest.mock('@gauzy/plugin-inbox', () => ({
	...jest.requireActual('../../../inbox/src/lib/email/inbound/mime'),
	...jest.requireActual('../../../inbox/src/lib/email/inbound/inbox-email.config')
}));

import { createSign, generateKeyPairSync, KeyObject } from 'node:crypto';
import { Readable } from 'node:stream';
import { UnauthorizedException } from '@nestjs/common';
import { isSesEnabled } from './ses-enabled';
import { SES_FAILED_VERDICT_SCORE, SesFetch, SesProvider } from './ses.provider';
import { signAwsRequest } from './sigv4';
import { snsStringToSign, SnsMessage } from './sns';
import { CERT_URL, RAW_MIME, receivedNotification, TOPIC_ARN } from './testing/ses-payloads';

// SNS's signing key, made for this run (the certificate URL answers its public key).
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const account = {
	id: 'a0000000-0000-4000-8000-00000000000a',
	providerId: 'ses',
	tenantId: 't0000000-0000-4000-8000-00000000000t',
	organizationId: 'o0000000-0000-4000-8000-00000000000o',
	scope: null,
	config: {
		topicArn: TOPIC_ARN,
		region: 'eu-west-1',
		accessKeyId: `AKID${'X'.repeat(12)}`,
		secretAccessKey: 'x'.repeat(40),
		s3Bucket: 'acme-inbound-mail',
		fromAddress: 'team@acme.test'
	}
};

/** An SNS message to the subscription, signed (SignatureVersion 2 unless stated) with `key`. */
function sns(fields: Partial<SnsMessage>, options: { version?: '1' | '2'; key?: KeyObject } = {}): SnsMessage {
	const message: SnsMessage = {
		Type: 'Notification',
		MessageId: 'b7a3c1f0-0000-4000-8000-000000000001',
		TopicArn: TOPIC_ARN,
		Timestamp: new Date().toISOString(),
		SignatureVersion: options.version ?? '2',
		SigningCertURL: CERT_URL,
		...fields
	};
	const text = snsStringToSign(message) as string;
	message.Signature = createSign(message.SignatureVersion === '1' ? 'RSA-SHA1' : 'RSA-SHA256')
		.update(text)
		.sign(options.key ?? privateKey, 'base64');
	return message;
}

/** SNS posts JSON as text/plain: the webhook route keeps it raw. */
function request(message: unknown) {
	return {
		headers: { 'content-type': 'text/plain; charset=UTF-8', 'x-amz-sns-message-type': 'Notification' },
		body: {},
		rawBody: Buffer.from(JSON.stringify(message)),
		query: {},
		url: `/api/inbox/inbound/ses/${account.id}`
	};
}

function recorder(answers: Record<string, { status?: number; body?: string; headers?: Record<string, string> }>) {
	const calls: Array<{ url: string; init: RequestInit }> = [];
	const fetcher: SesFetch = async (url, init) => {
		calls.push({ url, init });
		const answer = answers[`${init.method} ${url}`] ?? { status: 404, body: '{"message":"not found"}' };
		return new Response(answer.body ?? null, { status: answer.status ?? 200, headers: answer.headers ?? {} });
	};
	return { calls, fetcher };
}

const certificate = { [`GET ${CERT_URL}`]: { body: PUBLIC_PEM } };

describe('Amazon SES email provider', () => {
	it('is on only for the exact value true', () => {
		const warn = jest.fn();
		expect(isSesEnabled({}, warn)).toBe(false);
		expect(isSesEnabled({ EMAIL_PROVIDER_SES_ENABLED: 'true' }, warn)).toBe(true);
		expect(isSesEnabled({ EMAIL_PROVIDER_SES_ENABLED: 'yes' }, warn)).toBe(false);
		expect(warn).toHaveBeenCalledTimes(1);
	});

	it('signs requests with SigV4 (the AWS test suite’s get-vanilla vectors)', () => {
		// AWS's documented example credentials (not a key of anyone's), split so secret scanners see no credential.
		const example = {
			accessKeyId: 'AKIDEXAMPLE',
			secretAccessKey: ['wJalrXUtnFEMI', 'K7MDENG+bPxRfiCYEXAMPLEKEY'].join('/')
		};
		const at = new Date('2015-08-30T12:36:00Z');
		expect(
			signAwsRequest(
				{ method: 'GET', url: 'https://example.amazonaws.com/' },
				example,
				'us-east-1',
				'service',
				at
			)['authorization']
		).toBe(
			'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31'
		);
		expect(
			signAwsRequest(
				{ method: 'GET', url: 'https://example.amazonaws.com/?Param2=value2&Param1=value1' },
				example,
				'us-east-1',
				'service',
				at
			)['authorization']
		).toContain('Signature=b97d918cfa904a5beff61c982a1b6f458b799221646efd99d3219ec94cdf2500');
	});

	describe('verify (SNS signature, topic, time)', () => {
		it('accepts a signed notification of the account’s topic (SignatureVersion 2 and 1)', async () => {
			const { fetcher, calls } = recorder(certificate);
			const provider = new SesProvider(undefined, fetcher);
			const message = sns({ Message: JSON.stringify(receivedNotification()) });
			expect(await provider.verify(request(message), account)).toEqual({
				fingerprint: `sns:${message.MessageId}`,
				ttlMs: (2 * 3600 + 60) * 1000
			});
			const older = sns({ Message: 'x', MessageId: 'b7a3c1f0-0000-4000-8000-000000000002' }, { version: '1' });
			await expect(provider.verify(request(older), account)).resolves.toBeDefined();
			// The certificate is fetched once.
			expect(calls.filter((call) => call.url === CERT_URL)).toHaveLength(1);
		});

		it('refuses an unsigned or forged message, another topic, a stale one and a certificate off SNS', async () => {
			const { fetcher } = recorder({
				...certificate,
				'GET https://evil.example/cert.pem': { body: PUBLIC_PEM }
			});
			const provider = new SesProvider(undefined, fetcher);
			const unsigned = { ...sns({ Message: 'x' }), Signature: undefined };
			await expect(provider.verify(request(unsigned), account)).rejects.toBeInstanceOf(UnauthorizedException);
			const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
			await expect(
				provider.verify(request(sns({ Message: 'x' }, { key: other })), account)
			).rejects.toBeInstanceOf(UnauthorizedException);
			const changed = { ...sns({ Message: 'x' }), Message: 'y' };
			await expect(provider.verify(request(changed), account)).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(
				provider.verify(request(sns({ Message: 'x', TopicArn: `${TOPIC_ARN}-other` })), account)
			).rejects.toBeInstanceOf(UnauthorizedException);
			const stale = sns({ Message: 'x', Timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString() });
			await expect(provider.verify(request(stale), account)).rejects.toBeInstanceOf(UnauthorizedException);
			const offSns = sns({ Message: 'x', SigningCertURL: 'https://evil.example/cert.pem' });
			await expect(provider.verify(request(offSns), account)).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(provider.verify(request({}), account)).rejects.toBeInstanceOf(UnauthorizedException);
		});
	});

	describe('parse (recorded notifications)', () => {
		it('parses the message inside an SNS action, trusting SES’s own verdicts (DMARC included)', async () => {
			const [message] = await new SesProvider().parse(
				request(sns({ Message: JSON.stringify(receivedNotification()) })),
				account
			);
			expect(message?.messageId).toBe('<m-2@acme.test>');
			expect(message?.from).toEqual({ address: 'ada@acme.test', name: 'Lovelace, Ada' });
			expect(message?.envelopeRecipients).toEqual(['support.ever@inbox.example.test']);
			expect(message?.envelopeFrom).toBe('bounce@acme.test');
			// SES's checks, not the message's own (forged) Authentication-Results.
			expect([message?.spf, message?.dkim, message?.dmarc]).toEqual(['pass', 'pass', 'pass']);
			expect(message?.spamScore).toBeUndefined();
			expect(message?.providerMessageId).toBe('o3vrnil0e2ic28trm7dfhrc2v0clambda4nbp0g1');
		});

		it('quarantines a FAIL spam or virus verdict', async () => {
			const notification = receivedNotification();
			notification.receipt.virusVerdict = { status: 'FAIL' };
			const [message] = await new SesProvider().parse(
				request(sns({ Message: JSON.stringify(notification) })),
				account
			);
			expect(message?.spamScore).toBe(SES_FAILED_VERDICT_SCORE);
		});

		it('fetches a message an S3 action stored, from the account’s bucket only (SigV4)', async () => {
			const objectUrl = 'https://acme-inbound-mail.s3.eu-west-1.amazonaws.com/inbound/abc%20def';
			const { calls, fetcher } = recorder({ [`GET ${objectUrl}`]: { body: RAW_MIME } });
			const stored = receivedNotification({ content: undefined });
			stored.receipt.action = {
				type: 'S3',
				topicArn: TOPIC_ARN,
				bucketName: 'acme-inbound-mail',
				objectKey: 'inbound/abc def'
			} as never;
			const [message] = await new SesProvider(undefined, fetcher).parse(
				request(sns({ Message: JSON.stringify(stored) })),
				account
			);
			expect(message?.messageId).toBe('<m-2@acme.test>');
			const headers = calls[0]?.init.headers as Record<string, string>;
			expect(headers['authorization']).toMatch(
				/^AWS4-HMAC-SHA256 Credential=AKIDX{12}\/\d{8}\/eu-west-1\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/
			);
			// Another bucket is never read with the account's keys.
			const elsewhere = receivedNotification({ content: undefined });
			elsewhere.receipt.action = { type: 'S3', bucketName: 'someone-else', objectKey: 'k' } as never;
			await expect(
				new SesProvider(undefined, fetcher).parse(request(sns({ Message: JSON.stringify(elsewhere) })), account)
			).rejects.toThrow(/bucket/);
		});

		it('confirms a verified subscription on SNS, and stores nothing', async () => {
			const subscribe = 'https://sns.eu-west-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=x&Token=t';
			const { calls, fetcher } = recorder({ [`GET ${subscribe}`]: { body: '<ConfirmSubscriptionResponse/>' } });
			const confirmation = sns({
				Type: 'SubscriptionConfirmation',
				Message: 'You have chosen to subscribe…',
				Token: 't',
				SubscribeURL: subscribe
			});
			expect(await new SesProvider(undefined, fetcher).parse(request(confirmation), account)).toEqual([]);
			expect(calls.map((call) => call.url)).toEqual([subscribe]);
			const elsewhere = { ...confirmation, SubscribeURL: 'https://evil.example/confirm' };
			await expect(new SesProvider(undefined, fetcher).parse(request(elsewhere), account)).rejects.toThrow(
				/SNS URL/
			);
		});
	});

	describe('outbound transport and connection test', () => {
		it('sends the raw message through SESv2 SendEmail (SigV4)', async () => {
			const { calls, fetcher } = recorder({
				'POST https://email.eu-west-1.amazonaws.com/v2/email/outbound-emails': { body: '{"MessageId":"ses-1"}' }
			});
			const transport = new SesProvider(undefined, fetcher).createTransport(account) as {
				send(mail: unknown, callback: (error: Error | null, info?: Record<string, unknown>) => void): void;
			};
			const mail = {
				message: {
					messageId: () => '<out-1@acme.test>',
					getEnvelope: () => ({
						from: 'support.ever@inbox.example.test',
						to: ['ada@acme.test', 'bcc@acme.test']
					}),
					createReadStream: () =>
						Readable.from([Buffer.from('From: support.ever@inbox.example.test\r\n\r\nHi')])
				}
			};
			const info = await new Promise<Record<string, unknown>>((resolve, reject) =>
				transport.send(mail, (error, result) =>
					error ? reject(error) : resolve(result as Record<string, unknown>)
				)
			);
			expect(info['response']).toBe('ses:ses-1');
			expect(info['accepted']).toEqual(['ada@acme.test', 'bcc@acme.test']);
			const call = calls[0] as { init: RequestInit };
			expect(JSON.parse(String(call.init.body))).toEqual({
				Content: {
					Raw: { Data: Buffer.from('From: support.ever@inbox.example.test\r\n\r\nHi').toString('base64') }
				},
				FromEmailAddress: 'support.ever@inbox.example.test',
				Destination: { ToAddresses: ['ada@acme.test', 'bcc@acme.test'] }
			});
			expect((call.init.headers as Record<string, string>)['authorization']).toContain(
				'/eu-west-1/ses/aws4_request'
			);
		});

		it('reports the account, the sandbox, and a refused key', async () => {
			const url = 'GET https://email.eu-west-1.amazonaws.com/v2/email/account';
			const ok = recorder({ [url]: { body: '{"SendingEnabled":true,"ProductionAccessEnabled":true}' } });
			expect(await new SesProvider(undefined, ok.fetcher).verifyAccount(account)).toEqual({
				ok: true,
				message: 'Connected: the SES account can send.'
			});
			const sandbox = recorder({ [url]: { body: '{"SendingEnabled":true,"ProductionAccessEnabled":false}' } });
			expect((await new SesProvider(undefined, sandbox.fetcher).verifyAccount(account)).message).toContain(
				'sandbox'
			);
			const refused = recorder({ [url]: { status: 403, body: '{"message":"The security token is invalid."}' } });
			expect(await new SesProvider(undefined, refused.fetcher).verifyAccount(account)).toEqual({
				ok: false,
				message: 'AWS refused the access key.'
			});
		});
	});
});
