// cspell:ignore dmarc
// The platform signature helpers are the real ones; the rest of `@gauzy/core` (whose barrel boots the application)
// is not needed here.
jest.mock('@gauzy/core', () => ({
	EVER_REDIS_CLIENT: 'EVER_REDIS_CLIENT',
	...jest.requireActual('../../../../../../../core/src/lib/webhook/webhook-signature')
}));

import { UnauthorizedException } from '@nestjs/common';
import { signWebhookPayload } from '../../../../../../../core/src/lib/webhook/webhook-signature';
import { SAMPLE_MIME } from '../../testing/sample-mime';
import { EmailProviderRegistry } from '../email-provider.registry';
import { IInboundWebhookRequest, IProviderAccountContext } from '../email-provider.types';
import { GENERIC_SIGNATURE_HEADER, GenericWebhookProvider } from './generic-webhook.provider';

const SECRET = 'a-signing-secret-of-enough-length-1234';
const account: IProviderAccountContext = {
	id: null,
	providerId: 'generic',
	tenantId: null,
	organizationId: null,
	scope: null,
	config: { signingSecret: SECRET }
};

function request(body: unknown, header?: string, raw?: string): IInboundWebhookRequest {
	const text = raw ?? JSON.stringify(body);
	return {
		headers: header === undefined ? {} : { [GENERIC_SIGNATURE_HEADER]: header },
		body,
		rawBody: Buffer.from(text),
		query: {},
		url: '/api/inbox/inbound/generic/platform'
	};
}

function signed(body: unknown, secret = SECRET, timestamp?: number): IInboundWebhookRequest {
	const text = JSON.stringify(body);
	return request(body, signWebhookPayload(secret, text, timestamp ? { timestamp } : {}).header, text);
}

describe('GenericWebhookProvider', () => {
	let provider: GenericWebhookProvider;

	beforeEach(() => {
		provider = new GenericWebhookProvider(new EmailProviderRegistry());
	});

	describe('verify', () => {
		const body = { raw: Buffer.from(SAMPLE_MIME).toString('base64'), envelope: { to: ['a@b.test'] } };

		it('accepts a fresh delivery and names it by its timestamp and the signature that verified', async () => {
			const delivery = signed(body);
			const identity = await provider.verify(delivery, account);
			const header = String(delivery.headers[GENERIC_SIGNATURE_HEADER]);
			const [t, v1] = header.split(',').map((part) => part.slice(3 - (part.startsWith('t=') ? 1 : 0)));
			expect(identity.fingerprint).toBe(`${t}.${v1}`);
			// A captured request with the header reordered and an extra v1 is the same delivery.
			const reordered = {
				...delivery,
				headers: { [GENERIC_SIGNATURE_HEADER]: `v1=${'0'.repeat(64)},v1=${v1},t=${t}` }
			};
			expect((await provider.verify(reordered, account)).fingerprint).toBe(identity.fingerprint);
		});

		it('refuses an unsigned delivery, another secret, a stale timestamp and a changed body', async () => {
			await expect(provider.verify(request(body), account)).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(
				provider.verify(signed(body, 'another-secret-of-enough-length-12345'), account)
			).rejects.toBeInstanceOf(UnauthorizedException);
			const stale = Math.floor(Date.now() / 1000) - 3600;
			await expect(provider.verify(signed(body, SECRET, stale), account)).rejects.toBeInstanceOf(
				UnauthorizedException
			);
			const tampered = signed(body);
			tampered.rawBody = Buffer.from(JSON.stringify({ ...body, envelope: { to: ['evil@x.test'] } }));
			await expect(provider.verify(tampered, account)).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(provider.verify(request(body, 't=1,v1=zz'), account)).rejects.toBeInstanceOf(
				UnauthorizedException
			);
		});

		it('refuses everything when the account has no secret (there is no unsigned mode)', async () => {
			await expect(provider.verify(signed(body), { ...account, config: {} })).rejects.toBeInstanceOf(
				UnauthorizedException
			);
		});
	});

	describe('parse', () => {
		it('parses raw MIME with its envelope and verdicts', async () => {
			const [message] = await provider.parse(
				request({
					raw: Buffer.from(SAMPLE_MIME).toString('base64'),
					envelope: { from: 'bounce@acme.test', to: ['support.ever@inbox.example.test'] },
					authenticationResults: 'mx; spf=pass; dkim=fail; dmarc=fail',
					spamScore: 3.5
				})
			);
			expect(message?.messageId).toBe('<m-2@acme.test>');
			expect(message?.envelopeRecipients).toEqual(['support.ever@inbox.example.test']);
			expect(message?.envelopeFrom).toBe('bounce@acme.test');
			expect([message?.spf, message?.dkim, message?.dmarc]).toEqual(['pass', 'fail', 'fail']);
			expect(message?.spamScore).toBe(3.5);
			expect(message?.raw).toBeDefined();
		});

		it('parses structured messages, several per delivery', async () => {
			const messages = await provider.parse(
				request({
					messages: [
						{
							from: 'Ada <ada@acme.test>',
							to: ['support.ever@inbox.example.test'],
							subject: 'Hello',
							text: 'Hi',
							html: '<p>Hi</p>',
							inReplyTo: 'm-1@acme.test',
							references: ['m-0@acme.test'],
							attachments: [
								{
									filename: 'a/b.txt',
									contentType: 'text/plain',
									content: Buffer.from('x').toString('base64')
								}
							]
						},
						{ from: 'bob@acme.test', to: 'support.ever@inbox.example.test', subject: 'Second' }
					]
				})
			);
			expect(messages).toHaveLength(2);
			expect(messages[0]?.from).toEqual({ address: 'ada@acme.test', name: 'Ada' });
			expect(messages[0]?.inReplyTo).toBe('<m-1@acme.test>');
			expect(messages[0]?.references).toEqual(['<m-0@acme.test>']);
			expect(messages[0]?.attachments[0]?.filename).toBe('b.txt');
			// No Message-ID: one derived from the content, the same on a retry.
			expect(messages[1]?.messageId).toMatch(/^<[0-9a-f]{40}@inbox\.gauzy\.invalid>$/);
			const [again] = await provider.parse(
				request({ from: 'bob@acme.test', to: 'support.ever@inbox.example.test', subject: 'Second' })
			);
			expect(again?.messageId).toBe(messages[1]?.messageId);
			// Same sender, subject and text, other attachments: another message.
			const [withFile] = await provider.parse(
				request({
					from: 'bob@acme.test',
					to: 'support.ever@inbox.example.test',
					subject: 'Second',
					attachments: [{ filename: 'x.txt', content: Buffer.from('y').toString('base64') }]
				})
			);
			expect(withFile?.messageId).not.toBe(messages[1]?.messageId);
		});
	});

	it('registers itself, receiving only', () => {
		const registry = new EmailProviderRegistry();
		const own = new GenericWebhookProvider(registry);
		own.onModuleInit();
		expect(registry.get('generic')).toBe(own);
		expect(registry.describe()[0]?.capabilities).toEqual({ inbound: true, outbound: false, customDomains: true });
	});
});
