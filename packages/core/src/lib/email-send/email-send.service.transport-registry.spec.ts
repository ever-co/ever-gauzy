import { SMTPUtils } from './utils';
import { EmailSendService } from './email-send.service';
import { EmailTransportRegistry } from './email-transport.registry';

/**
 * The transport seam (plan 04 §5.5, G-P4-5): a transport a registered resolver supplies comes first; with none
 * registered, or none answering, mail takes the SMTP chain exactly as before.
 */
describe('EmailSendService and the email transport registry', () => {
	const scope = {
		organizationId: 'o0000000-0000-4000-8000-00000000000o',
		tenantId: 't0000000-0000-4000-8000-00000000000t'
	};
	const smtpRow = {
		id: 'c0000000-0000-4000-8000-00000000000c',
		host: 'smtp.example.test',
		port: 587,
		secure: false,
		fromAddress: 'billing@example.test',
		username: 'billing',
		password: 'stored-secret'
	};

	/** A nodemailer custom transport that records what it was handed and answers like a provider API. */
	function recordingTransport() {
		const sent: any[] = [];
		return {
			sent,
			transport: {
				name: 'recording',
				version: '1.0.0',
				send(mail: any, callback: (error: Error | null, info?: unknown) => void) {
					sent.push(mail.data);
					callback(null, {
						messageId: mail.message.messageId(),
						accepted: [].concat(mail.data.to),
						rejected: []
					});
				}
			}
		};
	}

	afterEach(() => jest.restoreAllMocks());

	it('takes the SMTP chain, unchanged, when no resolver is registered', async () => {
		jest.spyOn(SMTPUtils, 'verifyTransporter').mockResolvedValue(true);
		const customSmtpService = { findOneByOptions: jest.fn(async () => ({ ...smtpRow })) };
		const service = new EmailSendService(customSmtpService as any, {} as any, new EmailTransportRegistry());
		const getEmailConfig = jest
			.spyOn(service as any, 'getEmailConfig')
			.mockImplementation((config: unknown) => ({ config }));

		const instance: any = await service.getEmailInstance(scope);

		expect(customSmtpService.findOneByOptions).toHaveBeenCalledTimes(1);
		expect(getEmailConfig).toHaveBeenCalledTimes(1);
		expect(instance.config.host).toBe('smtp.example.test');
	});

	it('takes the SMTP chain when every resolver answers null for the tenant', async () => {
		jest.spyOn(SMTPUtils, 'verifyTransporter').mockResolvedValue(true);
		const registry = new EmailTransportRegistry();
		const asked: unknown[] = [];
		registry.register({
			id: 'inbox',
			resolve: async (request) => {
				asked.push(request);
				return null;
			}
		});
		const customSmtpService = { findOneByOptions: jest.fn(async () => ({ ...smtpRow })) };
		const service = new EmailSendService(customSmtpService as any, {} as any, registry);
		jest.spyOn(service as any, 'getEmailConfig').mockImplementation((config: unknown) => ({ config }));

		await service.getEmailInstance(scope);

		expect(asked).toEqual([{ ...scope, providerAccountId: undefined, requireFromAddress: true }]);
		expect(customSmtpService.findOneByOptions).toHaveBeenCalledTimes(1);
	});

	it("uses a resolver's transport and never reads Custom SMTP", async () => {
		const verify = jest.spyOn(SMTPUtils, 'verifyTransporter');
		const { transport } = recordingTransport();
		const registry = new EmailTransportRegistry();
		registry.register({
			id: 'inbox',
			resolve: async () => ({ transport, fromAddress: 'team@acme.test', source: 'resend:acct-1' })
		});
		const customSmtpService = { findOneByOptions: jest.fn() };
		const service = new EmailSendService(customSmtpService as any, {} as any, registry);

		const instance: any = await service.getEmailInstance(scope);

		expect(instance.config.message.from).toBe('team@acme.test');
		expect(customSmtpService.findOneByOptions).not.toHaveBeenCalled();
		expect(verify).not.toHaveBeenCalled();
	});

	it('a templated mail never goes out through a provider account without its own sender, but a message does (review F63)', async () => {
		jest.spyOn(SMTPUtils, 'verifyTransporter').mockResolvedValue(true);
		const { transport, sent } = recordingTransport();
		const registry = new EmailTransportRegistry();
		registry.register({
			id: 'inbox',
			resolve: async () => ({ transport, fromAddress: null, source: 'resend:acct-1' })
		});
		const customSmtpService = { findOneByOptions: jest.fn(async () => ({ ...smtpRow })) };
		const service = new EmailSendService(customSmtpService as any, {} as any, registry);
		jest.spyOn(service as any, 'getEmailConfig').mockImplementation((config: unknown) => ({ config }));

		// A password reset or an invite: the provider would send as MAIL_FROM_ADDRESS, so the SMTP chain sends it.
		const instance: any = await service.getEmailInstance(scope);
		expect(instance.config.host).toBe('smtp.example.test');
		expect(customSmtpService.findOneByOptions).toHaveBeenCalledTimes(1);

		// An Inbox reply names its own sender (the mailbox): the provider sends it.
		const result = await service.sendMessage(
			{ from: 'support@acme.test', to: ['ada@acme.test'], subject: 'Re: Invoice 42', text: 'Paid.' } as any,
			scope
		);
		expect(result.transport).toBe('provider:resend:acct-1');
		expect(sent).toHaveLength(1);
	});

	it('sends a message no template renders through the provider, with its threading headers', async () => {
		const { transport, sent } = recordingTransport();
		const registry = new EmailTransportRegistry();
		const asked: unknown[] = [];
		registry.register({
			id: 'inbox',
			resolve: async (request) => {
				asked.push(request);
				return { transport, fromAddress: 'noreply@acme.test', source: 'resend:acct-1' };
			}
		});
		const service = new EmailSendService({ findOneByOptions: jest.fn() } as any, {} as any, registry);

		const result = await service.sendMessage(
			{
				from: 'support.acme@inbox.gauzy.co',
				to: 'customer@example.test',
				subject: 'Re: Invoice 42',
				text: 'Thanks, paid today.',
				inReplyTo: '<m-1@example.test>',
				references: ['<m-0@example.test>', '<m-1@example.test>']
			},
			{ ...scope, providerAccountId: 'a0000000-0000-4000-8000-00000000000a' }
		);

		expect(asked).toEqual([{ ...scope, providerAccountId: 'a0000000-0000-4000-8000-00000000000a' }]);
		expect(result.transport).toBe('provider:resend:acct-1');
		expect(result.accepted).toEqual(['customer@example.test']);
		expect(typeof result.messageId).toBe('string');
		expect(sent).toHaveLength(1);
		// The message's own sender wins over the account's default.
		expect(sent[0].from).toBe('support.acme@inbox.gauzy.co');
		expect(sent[0].inReplyTo).toBe('<m-1@example.test>');
		expect(sent[0].references).toEqual(['<m-0@example.test>', '<m-1@example.test>']);
	});

	it('refuses a message without a tenant', async () => {
		const service = new EmailSendService({} as any, {} as any, new EmailTransportRegistry());
		await expect(service.sendMessage({ to: 'a@b.test', subject: 'x' }, { tenantId: '' as any })).rejects.toThrow(
			/tenant/
		);
	});
});
