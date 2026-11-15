// Must stay first: the entities barrel resolves the circular entity imports.
import '../../core/entities/internal';

import { PublicInvoiceController } from './public-invoice.controller';

/** The per-address limit a route's `@Throttle` sets, if any. */
function throttleLimitOf(handler: object): number | undefined {
	const limitKey = Reflect.getMetadataKeys(handler).find(
		(key) => typeof key === 'string' && key.startsWith('THROTTLER:LIMIT')
	);
	return limitKey ? Reflect.getMetadata(limitKey, handler) : undefined;
}

/**
 * Each answer from the estimate link that changes the estimate tells the team: every invoice handler in-app, and the
 * estimate's creator by email. A link holder flipping the answer between accepted and declined would tell them every
 * time, so the answer route is held to a per-address budget of its own, where throttling is on (`THROTTLE_ENABLED`).
 */
describe('PublicInvoiceController', () => {
	it('takes an answer to an estimate within a per-address budget of its own', () => {
		expect(throttleLimitOf(PublicInvoiceController.prototype.updateInvoiceByEstimateEmailToken)).toBe(5);
	});

	it("leaves reading a shared invoice to the deployment's budget", () => {
		expect(throttleLimitOf(PublicInvoiceController.prototype.findOneByPublicLink)).toBeUndefined();
	});
});

/** The PDF through the share link (ever-co/ever-gauzy#11856): checked as the read is, and held to a budget. */
describe('PublicInvoiceController.downloadByPublicLink', () => {
	const INVOICE = { id: '0b6e4c2a-1d3f-4e5a-8b7c-9d0e1f2a3b4c', tenantId: 'tenant-1' };

	function controller(read: jest.Mock, pdf: Buffer | null = Buffer.from('%PDF-1.7')) {
		const invoiceService = { generateTenantInvoicePdf: jest.fn(async () => pdf) };
		const response = { set: jest.fn(), end: jest.fn() };
		const subject = new PublicInvoiceController(
			{} as never,
			{} as never,
			{ findOneByConditions: read } as never,
			invoiceService as never
		);
		return { subject, invoiceService, response };
	}

	it('sends the PDF of the invoice the link opens, in the reader’s language', async () => {
		const { subject, invoiceService, response } = controller(jest.fn(async () => INVOICE));

		await subject.downloadByPublicLink(INVOICE.id, 'token', 'fr' as never, response as never);

		expect(invoiceService.generateTenantInvoicePdf).toHaveBeenCalledWith(INVOICE.id, 'tenant-1', 'fr');
		expect(response.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': 'application/pdf' }));
		expect(response.end).toHaveBeenCalledWith(Buffer.from('%PDF-1.7'));
	});

	it('renders nothing for a link that does not open the invoice (revoked, or of a voided invoice)', async () => {
		const refused = Object.assign(new Error('Forbidden'), { status: 403 });
		const { subject, invoiceService, response } = controller(jest.fn().mockRejectedValue(refused));

		await expect(subject.downloadByPublicLink(INVOICE.id, 'token', 'en' as never, response as never)).rejects.toBe(
			refused
		);
		expect(invoiceService.generateTenantInvoicePdf).not.toHaveBeenCalled();
		expect(response.end).not.toHaveBeenCalled();
	});

	it('holds a link holder to a per-address budget, since each download renders the PDF', () => {
		expect(throttleLimitOf(PublicInvoiceController.prototype.downloadByPublicLink)).toBe(10);
	});
});
