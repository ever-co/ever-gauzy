import '../core/entities/internal';

import { environment as env } from '@gauzy/config';
import { EmailStatusEnum, EmailTemplateEnum, LanguagesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { EmailService } from './email.service';

/**
 * `estimate-answered`: the team member who created an estimate hears that the client accepted or declined it. The
 * answer comes over the estimate's public link, so the email is sent with no request context: its tenant is the
 * organization's.
 */
describe('EmailService.sendEstimateAnswered', () => {
	const organization = { id: 'org-1', tenantId: 'tenant-1', name: 'Ever Org' } as any;
	const creator = { id: 'user-1', email: 'creator@org.test' } as any;

	let service: EmailService;
	let send: jest.Mock;
	let getEmailInstance: jest.Mock;
	let save: jest.Mock;

	beforeEach(() => {
		// A public request: no tenant to read from the context
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(undefined);
		send = jest.fn(async () => ({ originalMessage: { subject: 'Estimate 12 was accepted', html: '<p>h</p>' } }));
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

	const answer = {
		languageCode: LanguagesEnum.ENGLISH,
		email: 'creator@org.test',
		user: creator,
		organization,
		invoiceId: 'estimate-1',
		invoiceNumber: 12,
		isAccepted: true,
		contactName: 'Acme Corp',
		contactEmail: 'billing@acme.test',
		amount: '1,250.00',
		currency: 'USD'
	};

	it("sends the template to the creator through the organization's mail settings, with the estimate's link", async () => {
		await service.sendEstimateAnswered(answer);

		expect(getEmailInstance).toHaveBeenCalledWith({ organizationId: 'org-1', tenantId: 'tenant-1' });
		expect(send).toHaveBeenCalledWith({
			template: EmailTemplateEnum.ESTIMATE_ANSWERED,
			message: { to: 'creator@org.test' },
			locals: {
				// The deployment's name, logo and links, for the layout's header and footer
				...env.appIntegrationConfig,
				locale: LanguagesEnum.ENGLISH,
				host: env.clientBaseUrl,
				organizationId: 'org-1',
				tenantId: 'tenant-1',
				organizationName: 'Ever Org',
				invoiceNumber: 12,
				isAccepted: true,
				isConverted: false,
				contactName: 'Acme Corp',
				contactEmail: 'billing@acme.test',
				amount: '1,250.00',
				currency: 'USD',
				estimateUrl: `${env.clientBaseUrl}#/pages/accounting/invoices/estimates/view/estimate-1`,
				invoiceUrl: `${env.clientBaseUrl}#/pages/accounting/invoices/view/estimate-1`
			}
		});
	});

	it('tells an acceptance that turned the estimate into a draft invoice, which the template links instead', async () => {
		await service.sendEstimateAnswered({ ...answer, isConverted: true });

		expect(send.mock.calls[0][0].locals).toEqual(
			expect.objectContaining({
				isAccepted: true,
				isConverted: true,
				invoiceUrl: `${env.clientBaseUrl}#/pages/accounting/invoices/view/estimate-1`
			})
		);
	});

	it('files the email in the history of the organization and its tenant, for the creator', async () => {
		await service.sendEstimateAnswered(answer);

		expect(save).toHaveBeenCalledWith(
			expect.objectContaining({
				email: 'creator@org.test',
				name: 'Estimate 12 was accepted',
				status: EmailStatusEnum.SENT,
				tenantId: 'tenant-1',
				organizationId: 'org-1',
				user: creator
			})
		);
	});

	it('sends empty values for what the estimate does not state, which the template leaves out', async () => {
		await service.sendEstimateAnswered({
			...answer,
			isAccepted: false,
			contactName: null,
			contactEmail: undefined,
			amount: null,
			currency: undefined
		});

		expect(send.mock.calls[0][0].locals).toEqual(
			expect.objectContaining({ isAccepted: false, contactName: '', contactEmail: '', amount: '', currency: '' })
		);
	});

	it('logs a failed send and files it as failed, without failing the answer', async () => {
		send.mockRejectedValueOnce(new Error('SMTP down'));

		await expect(service.sendEstimateAnswered(answer)).resolves.toBeUndefined();

		expect((service as any).logger.error).toHaveBeenCalledWith(
			expect.stringContaining('The answer to estimate 12 could not be emailed')
		);
		expect(save).toHaveBeenCalledWith(expect.objectContaining({ status: EmailStatusEnum.FAILED }));
	});

	it('sends nothing to an address of a blocked domain', async () => {
		await service.sendEstimateAnswered({ ...answer, email: 'someone@example.com' });

		expect(send).not.toHaveBeenCalled();
		expect(save).not.toHaveBeenCalled();
	});
});
