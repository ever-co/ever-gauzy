/**
 * The adapter that answers the order's invoicing port with the platform's own finance document.
 *
 * `@gauzy/core`'s barrel is doubled at the module boundary for the reason the package's other suites give;
 * the finance service is the one collaborator, and it is doubled with the calls the adapter makes, so what
 * the suite reads is exactly the document the adapter asks the platform to write.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;

	return {
		...jest.requireActual('@gauzy/core/src/lib/money/decimal'),
		InvoiceService: class {},
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
		RequestContext: {
			currentTenantId: () => 'tenant-1',
			getLanguageCode: () => 'de',
			currentRequest: () => ({ headers: { origin: 'https://app.example.com' } })
		},
		wrapSerialize: (entity: unknown) => entity,
		versionExpectationOf: () => undefined,
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator
	};
});

import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DiscountTaxTypeEnum, InvoiceStatusTypesEnum, InvoiceTypeEnum } from '@gauzy/contracts';
import { IOrderInvoiceDocument } from '../order.types';
import { OrderInvoicingAdapter } from './order-invoicing.adapter';

/** The finance service, as far as the adapter calls it. */
function financeService(overrides: Record<string, unknown> = {}) {
	return {
		getHighestInvoiceNumber: jest.fn(async () => ({ max: '41' })),
		create: jest.fn(async (entity: any) => ({
			...entity,
			id: 'invoice-42',
			invoiceItems: entity.invoiceItems.map((item: any, index: number) => ({ ...item, id: `item-${index + 1}` }))
		})),
		findOneByIdString: jest.fn(),
		update: jest.fn(async () => ({ affected: 1 })),
		sendEmail: jest.fn(async () => ({ sent: true })),
		...overrides
	};
}

/** A two-item document, every figure as exact decimal text. */
const DOCUMENT: IOrderInvoiceDocument = {
	isEstimate: false,
	tenantId: 'tenant-1',
	organizationId: 'organization-1',
	currency: 'USD',
	contactId: 'contact-1',
	sentTo: 'buyer@example.com',
	paymentTermId: 'term-1',
	reference: 'ORD-000123',
	discountTotal: '0.05',
	taxTotal: '0.57',
	grandTotal: '6.18',
	items: [
		{
			key: 'line-1',
			description: 'Widget (W-1)',
			quantity: '3',
			unitPrice: '0.1',
			totalValue: '0.3',
			productId: 'product-1',
			applyTax: true,
			applyDiscount: true
		},
		{
			key: 'shipping-1',
			description: 'Courier',
			quantity: '1',
			unitPrice: '5',
			totalValue: '5',
			applyTax: true,
			applyDiscount: false
		}
	]
};

describe('OrderInvoicingAdapter — the order’s document, written by the platform’s finance service', () => {
	it('numbers the document in the tenant’s sequence and writes every figure as the decimal text it was given', async () => {
		const finance = financeService();
		const adapter = new OrderInvoicingAdapter(finance as never);

		const issued = await adapter.issue(DOCUMENT);

		expect(finance.create).toHaveBeenCalledTimes(1);
		const written = finance.create.mock.calls[0][0];

		expect(written).toMatchObject({
			invoiceNumber: 42,
			currency: 'USD',
			isEstimate: false,
			status: InvoiceStatusTypesEnum.DRAFT,
			invoiceType: InvoiceTypeEnum.DETAILED_ITEMS,
			// Flat amounts, as the order decided them: a percentage the document re-applied could land on
			// another total.
			discountValue: '0.05',
			discountType: DiscountTaxTypeEnum.FLAT_VALUE,
			tax: '0.57',
			taxType: DiscountTaxTypeEnum.FLAT_VALUE,
			totalValue: '6.18',
			terms: '',
			sentTo: 'buyer@example.com',
			paymentTermId: 'term-1',
			fromOrganizationId: 'organization-1',
			toContactId: 'contact-1',
			tenantId: 'tenant-1',
			organizationId: 'organization-1'
		});
		expect(written.invoiceItems).toEqual([
			expect.objectContaining({
				description: 'Widget (W-1)',
				quantity: '3',
				price: '0.1',
				totalValue: '0.3',
				applyTax: true,
				applyDiscount: true,
				productId: 'product-1',
				tenantId: 'tenant-1',
				organizationId: 'organization-1'
			}),
			expect.objectContaining({ description: 'Courier', quantity: '1', price: '5', totalValue: '5' })
		]);

		expect(issued).toEqual({
			invoiceId: 'invoice-42',
			invoiceNumber: 42,
			items: [
				{ key: 'line-1', invoiceItemId: 'item-1' },
				{ key: 'shipping-1', invoiceItemId: 'item-2' }
			]
		});
	});

	it('writes an estimate under the estimate’s own status vocabulary', async () => {
		const finance = financeService();

		await new OrderInvoicingAdapter(finance as never).issue({ ...DOCUMENT, isEstimate: true });

		expect(finance.create.mock.calls[0][0]).toMatchObject({ isEstimate: true, status: 'DRAFT' });
	});

	it('refuses a figure that is not exact decimal text, and writes nothing', async () => {
		const finance = financeService();
		const adapter = new OrderInvoicingAdapter(finance as never);

		await expect(
			adapter.issue({
				...DOCUMENT,
				grandTotal: 6.18 as never,
				items: [{ ...DOCUMENT.items[0], unitPrice: '1e-7' }]
			})
		).rejects.toThrow(/ORDER_INVOICE_DOCUMENT_NOT_DECIMAL: grandTotal, items\[0\]\.unitPrice/);
		await expect(adapter.issue({ ...DOCUMENT, items: [] })).rejects.toBeInstanceOf(BadRequestException);
		expect(finance.create).not.toHaveBeenCalled();
	});

	it('refuses to answer with links when the stored document does not carry the items it was given', async () => {
		const finance = financeService({
			create: jest.fn(async (entity: any) => ({
				...entity,
				id: 'invoice-42',
				invoiceItems: [{ id: 'item-1', description: 'Widget (W-1)' }]
			}))
		});

		await expect(new OrderInvoicingAdapter(finance as never).issue(DOCUMENT)).rejects.toBeInstanceOf(
			InternalServerErrorException
		);
	});

	it('reads a document of the caller’s tenant, and answers null for one it cannot find', async () => {
		const finance = financeService({
			findOneByIdString: jest
				.fn()
				.mockResolvedValueOnce({
					id: 'invoice-42',
					invoiceNumber: 42,
					isEstimate: true,
					isAccepted: null,
					status: 'SENT'
				})
				.mockRejectedValueOnce(new NotFoundException())
		});
		const adapter = new OrderInvoicingAdapter(finance as never);

		await expect(adapter.read('invoice-42')).resolves.toEqual({
			invoiceId: 'invoice-42',
			invoiceNumber: 42,
			isEstimate: true,
			isAccepted: null,
			status: 'SENT'
		});
		await expect(adapter.read('invoice-of-another-tenant')).resolves.toBeNull();
	});

	it('voids a document by its status, keeping the row and its number', async () => {
		const finance = financeService();

		await new OrderInvoicingAdapter(finance as never).voidDocument('invoice-42', 'Voided: superseded.');

		expect(finance.update).toHaveBeenCalledWith('invoice-42', {
			status: InvoiceStatusTypesEnum.VOID,
			internalNote: 'Voided: superseded.'
		});
	});
});

describe('OrderInvoicingAdapter.sendEstimate — the platform’s estimate e-mail, reported rather than raised', () => {
	const ESTIMATE = { id: 'invoice-42', invoiceNumber: 42, organizationId: 'organization-1', isEstimate: true };

	it('sends through the finance service with the caller’s language and origin, and marks the estimate sent', async () => {
		const finance = financeService({ findOneByIdString: jest.fn(async () => ESTIMATE) });

		const delivery = await new OrderInvoicingAdapter(finance as never).sendEstimate(
			'invoice-42',
			'buyer@example.com'
		);

		expect(delivery).toEqual({ sent: true, recipient: 'buyer@example.com' });
		expect(finance.sendEmail).toHaveBeenCalledWith(
			'de',
			'buyer@example.com',
			42,
			'invoice-42',
			true,
			'https://app.example.com',
			'organization-1'
		);
		expect(finance.update).toHaveBeenCalledWith('invoice-42', { status: 'SENT', sentTo: 'buyer@example.com' });
	});

	it('reports the step that failed, and leaves the estimate as it was', async () => {
		const finance = financeService({
			findOneByIdString: jest.fn(async () => ESTIMATE),
			sendEmail: jest.fn(async () => ({ sent: false, reason: 'EMAIL_NOT_SENT' }))
		});

		await expect(
			new OrderInvoicingAdapter(finance as never).sendEstimate('invoice-42', 'buyer@example.com')
		).resolves.toEqual({ sent: false, recipient: 'buyer@example.com', reason: 'EMAIL_NOT_SENT' });
		expect(finance.update).not.toHaveBeenCalled();
	});

	it('never raises: an estimate it cannot read is reported as not prepared', async () => {
		const finance = financeService({
			findOneByIdString: jest.fn(async () => {
				throw new NotFoundException();
			})
		});

		await expect(
			new OrderInvoicingAdapter(finance as never).sendEstimate('invoice-42', 'buyer@example.com')
		).resolves.toEqual({ sent: false, recipient: 'buyer@example.com', reason: 'EMAIL_NOT_PREPARED' });
		expect(finance.sendEmail).not.toHaveBeenCalled();
	});
});

describe('OrderInvoicingAdapter.answerEstimate — the buyer’s answer, on the estimate itself', () => {
	it('writes the finance document’s own accept flag and the status that goes with it', async () => {
		const finance = financeService();
		const adapter = new OrderInvoicingAdapter(finance as never);

		await adapter.answerEstimate('invoice-42', true);
		await adapter.answerEstimate('invoice-43', false);

		expect(finance.update.mock.calls).toEqual([
			['invoice-42', { isAccepted: true, status: 'ACCEPTED' }],
			['invoice-43', { isAccepted: false, status: 'REJECTED' }]
		]);
	});
});
