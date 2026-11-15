// Must stay first: the entities barrel resolves the circular entity imports.
import '../core/entities/internal';

import { InvoiceService } from './invoice.service';

/**
 * The PDF of an invoice rendered outside a request (the payment reminder sweep): the invoice is read by its id and its
 * tenant, with what the document shows, and rendered as the request's own `generateInvoicePdf` renders it.
 */
describe('InvoiceService.generateTenantInvoicePdf', () => {
	const invoice = {
		id: 'invoice-1',
		tenantId: 'tenant-1',
		invoiceNumber: 12,
		fromOrganization: { id: 'org-1', name: 'Ever Org' },
		toContact: { id: 'contact-1', name: 'Acme Corp' },
		invoiceItems: []
	};

	function serviceWith(found: unknown) {
		const repository = { findOne: jest.fn(async () => found) };
		const pdfmaker = { generatePdf: jest.fn(async () => Buffer.from('%PDF')) };
		const i18n = { translate: jest.fn(async (key: string) => key) };
		const service = new InvoiceService(
			repository as never,
			{} as never,
			{} as never,
			{} as never,
			pdfmaker as never,
			i18n as never,
			{} as never
		);
		return { service, repository, pdfmaker, i18n };
	}

	afterEach(() => jest.restoreAllMocks());

	it('reads the invoice by its id and its tenant, with what the document shows, and renders it in the language', async () => {
		const { service, repository, pdfmaker, i18n } = serviceWith(invoice);

		await expect(service.generateTenantInvoicePdf('invoice-1', 'tenant-1', 'bg')).resolves.toEqual(
			Buffer.from('%PDF')
		);

		expect(repository.findOne).toHaveBeenCalledWith({
			where: { id: 'invoice-1', tenantId: 'tenant-1' },
			relations: {
				fromOrganization: true,
				invoiceItems: {
					employee: { user: true },
					expense: true,
					product: { translations: true },
					project: true,
					task: true
				},
				toContact: true
			}
		});
		expect(i18n.translate).toHaveBeenCalledWith('USER_ORGANIZATION.INVOICES_PAGE.INVOICE', { lang: 'bg' });
		expect(pdfmaker.generatePdf).toHaveBeenCalledTimes(1);
	});

	it('renders nothing for an invoice the tenant does not have', async () => {
		const { service, pdfmaker } = serviceWith(null);

		await expect(service.generateTenantInvoicePdf('invoice-1', 'tenant-2', 'en')).resolves.toBeNull();

		expect(pdfmaker.generatePdf).not.toHaveBeenCalled();
	});
});
