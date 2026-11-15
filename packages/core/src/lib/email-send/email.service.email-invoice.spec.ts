import '../core/entities/internal';

import { LanguagesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { EmailService } from './email.service';

/**
 * Emailing an invoice or an estimate says whether the email was handed to the mail transport: an address of a domain
 * the platform never emails (`@example.com`) is not sent, and the caller has to know, so an invoice's email row does
 * not keep naming the invoice its payment reminders would follow.
 */
describe('EmailService.emailInvoice — whether the email went', () => {
	let service: EmailService;
	let send: jest.Mock;

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		send = jest.fn(async () => ({ originalMessage: { subject: 's', html: 'h' } }));
		const instance = { send };
		service = new EmailService(
			{ save: jest.fn(async (entity: unknown) => entity) } as never,
			{ findOneBy: jest.fn(async () => ({ id: 'template-1' })) } as never,
			{ findOneBy: jest.fn(async () => ({ id: 'org-1', tenantId: 'tenant-1', name: 'Org' })) } as never,
			{ getEmailInstance: jest.fn(async () => instance), getInstance: jest.fn(async () => instance) } as never
		);
		(service as unknown as { logger: unknown }).logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
	});

	afterEach(() => jest.restoreAllMocks());

	const emailTo = (email: string) =>
		service.emailInvoice(
			LanguagesEnum.ENGLISH,
			email,
			'cGRm',
			43,
			'invoice-43',
			false,
			'token',
			'https://app.ever.team',
			{ id: 'org-1', tenantId: 'tenant-1', name: 'Org' } as never
		);

	it('answers true once the transport took it', async () => {
		await expect(emailTo('billing@client.test')).resolves.toBe(true);
		expect(send).toHaveBeenCalledTimes(1);
	});

	it('answers false, and sends nothing, for an address of a domain the platform never emails', async () => {
		await expect(emailTo('billing@example.com')).resolves.toBe(false);
		expect(send).not.toHaveBeenCalled();
	});
});
