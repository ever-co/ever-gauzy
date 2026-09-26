import { SMTPUtils } from './utils';
import { EmailSendService } from './email-send.service';

/**
 * `getEmailInstance` builds the transport from a stored SMTP configuration however the CRUD base answered it.
 *
 * Under `DB_ORM=mikro-orm`, `CustomSmtpService.findOneByOptions` answers `wrap(entity).toJSON()`: the row's data
 * without `CustomSmtp`'s prototype. The service called `getSmtpTransporter()` on it, which failed: with an
 * organization's own configuration no e-mail went out at all, and with only a tenant's the error was swallowed and
 * mail went through the platform's default server. The row here is such a plain object, the configuration an
 * organization stored.
 */
describe("EmailSendService uses an organization's own SMTP configuration from a serialized row", () => {
	const row = {
		id: 'c0000000-0000-4000-8000-00000000000c',
		host: 'smtp.example.test',
		port: 465,
		secure: false,
		fromAddress: 'billing@example.test',
		username: 'billing',
		password: 'stored-secret'
	};

	afterEach(() => jest.restoreAllMocks());

	it('builds the transport from the row, not the default server', async () => {
		const verified: unknown[] = [];
		jest.spyOn(SMTPUtils, 'verifyTransporter').mockImplementation(async (transport) => {
			verified.push(transport);
			return true;
		});
		const customSmtpService = { findOneByOptions: jest.fn(async () => ({ ...row })) };
		const service = new EmailSendService(customSmtpService as any, {} as any);
		const getEmailConfig = jest
			.spyOn(service as any, 'getEmailConfig')
			.mockImplementation((config: unknown) => ({ config }));

		const instance: any = await service.getEmailInstance({
			organizationId: 'o0000000-0000-4000-8000-00000000000o',
			tenantId: 't0000000-0000-4000-8000-00000000000t'
		});

		// Once, from the organization's row: the default server was never tried.
		expect(customSmtpService.findOneByOptions).toHaveBeenCalledTimes(1);
		expect(getEmailConfig).toHaveBeenCalledTimes(1);
		expect(instance.config).toEqual({
			fromAddress: 'billing@example.test',
			host: 'smtp.example.test',
			port: 465,
			// Port 465 is always secure, as the entity's own method decides.
			secure: true,
			auth: { user: 'billing', pass: 'stored-secret' }
		});
		expect(verified).toHaveLength(1);
	});
});
