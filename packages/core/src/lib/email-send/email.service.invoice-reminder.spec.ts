import '../core/entities/internal';

import { environment as env } from '@gauzy/config';
import { EmailStatusEnum, EmailTemplateEnum, LanguagesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { EmailService } from './email.service';

/**
 * `invoice-reminder`: the client of an unpaid invoice hears that it is due soon, or overdue. The payment reminder sweep
 * sends it with no request context, so its tenant is the organization's, and every attempt is filed in the
 * organization's email history, which is where the organization sees its reminders.
 */
describe('EmailService.sendInvoiceReminder', () => {
	const organization = { id: 'org-1', tenantId: 'tenant-1', name: 'Ever Org' } as any;

	let service: EmailService;
	let send: jest.Mock;
	let getEmailInstance: jest.Mock;
	let save: jest.Mock;

	beforeEach(() => {
		// The sweep runs outside any request: no tenant to read from the context
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(undefined);
		send = jest.fn(async () => ({
			originalMessage: { subject: 'Invoice 12 from Ever Org is overdue', html: '<p>h</p>' }
		}));
		getEmailInstance = jest.fn(async () => ({ send }));
		save = jest.fn(async (entity: unknown) => entity);
		service = new EmailService(
			{ save } as any,
			{ findOneBy: jest.fn(async () => ({ id: 'template-1' })) } as any,
			{ findOneBy: jest.fn() } as any,
			{ getEmailInstance } as any
		);
		(service as any).logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
	});

	afterEach(() => jest.restoreAllMocks());

	const reminder = {
		languageCode: LanguagesEnum.BULGARIAN,
		email: 'billing@acme.test',
		organization,
		invoiceId: 'invoice-1',
		invoiceNumber: 12,
		isOverdue: true,
		dueDate: '2026-11-20',
		amountDue: '1,250.00',
		currency: 'USD',
		contactName: 'Acme Corp',
		publicToken: 'share-token',
		pdf: Buffer.from('%PDF').toString('base64')
	};

	it("sends the template, with the invoice attached and its public page, through the organization's mail settings", async () => {
		await expect(service.sendInvoiceReminder(reminder)).resolves.toBe(true);

		expect(getEmailInstance).toHaveBeenCalledWith({ organizationId: 'org-1', tenantId: 'tenant-1' });
		expect(send).toHaveBeenCalledWith({
			template: EmailTemplateEnum.INVOICE_REMINDER,
			message: {
				to: 'billing@acme.test',
				attachments: [{ filename: 'Invoice-12.pdf', content: reminder.pdf, encoding: 'base64' }]
			},
			locals: {
				// The deployment's name, logo and links, for the layout's header and footer
				...env.appIntegrationConfig,
				locale: LanguagesEnum.BULGARIAN,
				host: env.clientBaseUrl,
				organizationId: 'org-1',
				tenantId: 'tenant-1',
				organizationName: 'Ever Org',
				invoiceNumber: 12,
				isOverdue: true,
				dueDate: '2026-11-20',
				amountDue: '1,250.00',
				currency: 'USD',
				contactName: 'Acme Corp',
				invoiceUrl: `${env.clientBaseUrl}#/share/invoices/invoice-1/share-token`,
				isPdfAttached: true
			}
		});
	});

	it('sends no attachment, and says so to the template, when no PDF could be generated', async () => {
		await service.sendInvoiceReminder({ ...reminder, pdf: null });

		const [options] = send.mock.calls[0];
		expect(options.message).toEqual({ to: 'billing@acme.test' });
		expect(options.locals.isPdfAttached).toBe(false);
	});

	it('sends empty values for what the invoice does not state, which the template leaves out', async () => {
		await service.sendInvoiceReminder({
			...reminder,
			isOverdue: false,
			currency: null,
			contactName: undefined,
			// The organization never generated a public link
			publicToken: null
		});

		expect(send.mock.calls[0][0].locals).toEqual(
			expect.objectContaining({ isOverdue: false, currency: '', contactName: '', invoiceUrl: '' })
		);
	});

	it("files the email in the organization's history, in its tenant", async () => {
		await service.sendInvoiceReminder(reminder);

		expect(save).toHaveBeenCalledWith(
			expect.objectContaining({
				email: 'billing@acme.test',
				name: 'Invoice 12 from Ever Org is overdue',
				status: EmailStatusEnum.SENT,
				tenantId: 'tenant-1',
				organizationId: 'org-1'
			})
		);
	});

	it('files a failed send as failed and raises it, so the sweep tries the reminder again', async () => {
		send.mockRejectedValueOnce(new Error('SMTP down'));

		await expect(service.sendInvoiceReminder(reminder)).rejects.toThrow('SMTP down');

		expect((service as any).logger.error).toHaveBeenCalledWith(
			expect.stringContaining('The payment reminder of invoice 12 could not be emailed')
		);
		expect(save).toHaveBeenCalledWith(expect.objectContaining({ status: EmailStatusEnum.FAILED }));
	});

	it('sends nothing to an address of a blocked domain, and answers that it did not', async () => {
		await expect(service.sendInvoiceReminder({ ...reminder, email: 'someone@example.com' })).resolves.toBe(false);

		expect(send).not.toHaveBeenCalled();
		expect(save).not.toHaveBeenCalled();
	});
});
