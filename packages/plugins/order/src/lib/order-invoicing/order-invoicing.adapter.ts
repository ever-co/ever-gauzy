import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import {
	DiscountTaxTypeEnum,
	EstimateStatusTypesEnum,
	ID,
	IInvoice,
	InvoiceStatusTypesEnum,
	InvoiceTypeEnum
} from '@gauzy/contracts';
import { InvoiceService, RequestContext, isValidDecimalString } from '@gauzy/core';
import {
	IOrderEstimateDelivery,
	IOrderInvoiceDocument,
	IOrderInvoiceDocumentState,
	IOrderInvoiceIssued,
	IOrderInvoicingPort
} from '../order.types';
import { orderScopeColumns } from '../order-history/order-row-scope';

/**
 * The invoicing capability of the order package, answered by the platform's own finance document.
 *
 * An order is billed by the core `invoice` row — the document an accountant, the invoice list, the PDF,
 * the payment register and the estimate e-mail all already read — and this class is the seam through which
 * the order package reaches it. It owns no table and keeps no state of its own: every write is
 * `InvoiceService`'s, so the document an order issues is an ordinary invoice in every respect.
 *
 * It is a facade, and a thin one. It is not a provider of the order module: that module is also hosted by
 * the worker process, which builds none of the e-mail, PDF and translation providers the finance module
 * needs, so `OrderPlatformAdaptersModule` provides it and the installation binds the `ORDER_INVOICING`
 * port to it (`apps/api/src/plugin-composition.ts`). The domain service injects the token, never this
 * class.
 *
 * **Money crosses as the decimal text the order computed.** The finance columns are `numeric`, and their
 * transformer passes a stated value through untouched, so the digits written are the digits the order's
 * totals function produced; a value parsed into a `number` on the way would be a figure the order never
 * stated. The discount and the tax are written as flat amounts for the same reason: the order decided them,
 * and a percentage the document re-applied could land on another total.
 */
@Injectable()
export class OrderInvoicingAdapter implements IOrderInvoicingPort {
	constructor(private readonly invoiceService: InvoiceService) {}

	/**
	 * Writes one document and its items, numbered in the tenant's invoice sequence.
	 *
	 * Invoices and estimates share one number sequence per tenant, and the platform allocates the next one
	 * as its highest number plus one — the same rule the finance screens apply. The document and its items
	 * are one write: the items ride the document's own cascade, so a document is never stored without the
	 * items it bills.
	 *
	 * @param document The document, every figure as the order computed it.
	 * @returns The document's identity and number, and the item each key became.
	 * @throws BadRequestException when the document states no item, or a figure that is not an exact decimal.
	 * @throws InternalServerErrorException when the stored document does not carry the items it was given.
	 */
	public async issue(document: IOrderInvoiceDocument): Promise<IOrderInvoiceIssued> {
		if (!document?.items?.length) {
			throw new BadRequestException('ORDER_INVOICE_DOCUMENT_EMPTY: a document bills at least one item.');
		}

		const figures: Array<[string, unknown]> = [
			['discountTotal', document.discountTotal],
			['taxTotal', document.taxTotal],
			['grandTotal', document.grandTotal],
			...document.items.flatMap(
				(item, index): Array<[string, unknown]> => [
					[`items[${index}].quantity`, item.quantity],
					[`items[${index}].unitPrice`, item.unitPrice],
					[`items[${index}].totalValue`, item.totalValue]
				]
			)
		];
		const inexact = figures.filter(([, value]) => !isValidDecimalString(value));

		if (inexact.length) {
			throw new BadRequestException(
				`ORDER_INVOICE_DOCUMENT_NOT_DECIMAL: ${inexact.map(([field]) => field).join(', ')} must be exact decimal text.`
			);
		}

		const scope = orderScopeColumns({ tenantId: document.tenantId, organizationId: document.organizationId });
		const highest = (await this.invoiceService.getHighestInvoiceNumber()) as { max?: unknown } | undefined;
		const invoiceNumber = Number(highest?.max ?? 0) + 1;

		const saved = await this.invoiceService.create({
			...scope,
			invoiceNumber,
			invoiceDate: new Date(),
			currency: document.currency,
			isEstimate: document.isEstimate,
			status: document.isEstimate ? EstimateStatusTypesEnum.DRAFT : InvoiceStatusTypesEnum.DRAFT,
			invoiceType: InvoiceTypeEnum.DETAILED_ITEMS,
			discountValue: document.discountTotal,
			discountType: DiscountTaxTypeEnum.FLAT_VALUE,
			tax: document.taxTotal,
			taxType: DiscountTaxTypeEnum.FLAT_VALUE,
			totalValue: document.grandTotal,
			// The column is required and states the document's terms of payment; the settlement schedule is
			// the term the order was placed against, so the text column is left empty rather than invented.
			terms: '',
			internalNote: `${document.isEstimate ? 'Quote' : 'Invoice'} for order ${document.reference}.`,
			sentTo: document.sentTo,
			paymentTermId: document.paymentTermId,
			fromOrganization: { id: document.organizationId },
			fromOrganizationId: document.organizationId,
			...(document.contactId ? { toContact: { id: document.contactId }, toContactId: document.contactId } : {}),
			invoiceItems: document.items.map((item) => ({
				...scope,
				description: item.description,
				quantity: item.quantity,
				price: item.unitPrice,
				totalValue: item.totalValue,
				applyTax: item.applyTax,
				applyDiscount: item.applyDiscount,
				...(item.productId ? { product: { id: item.productId }, productId: item.productId } : {})
			}))
		} as unknown as IInvoice);

		// The items come back in the order they were given — the cascade inserts the collection as it was
		// stated, under either ORM — so each one is matched to its key by position, and the match is checked
		// rather than assumed: a link recorded against the wrong item would bill one line with another's
		// figures.
		const stored = (saved?.invoiceItems ?? []) as Array<{ id?: ID; description?: string }>;

		if (
			!saved?.id ||
			stored.length !== document.items.length ||
			stored.some((item, index) => !item?.id || item.description !== document.items[index].description)
		) {
			throw new InternalServerErrorException(
				`ORDER_INVOICE_ITEMS_UNMATCHED: document ${saved?.id ?? '(unsaved)'} came back with ${stored.length} item(s) ` +
					`for the ${document.items.length} it was given.`
			);
		}

		return {
			invoiceId: saved.id,
			invoiceNumber,
			items: document.items.map((item, index) => ({ key: item.key, invoiceItemId: stored[index].id as ID }))
		};
	}

	/**
	 * Reads one document of the caller's tenant.
	 *
	 * @param invoiceId The document.
	 * @returns What the document states, or null when the caller's tenant has no such document.
	 */
	public async read(invoiceId: ID): Promise<IOrderInvoiceDocumentState | null> {
		let invoice: IInvoice;

		try {
			invoice = await this.invoiceService.findOneByIdString(invoiceId);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}

		if (!invoice) {
			return null;
		}

		return {
			invoiceId: invoice.id,
			invoiceNumber: invoice.invoiceNumber,
			isEstimate: Boolean(invoice.isEstimate),
			isAccepted: invoice.isAccepted ?? null,
			status: invoice.status
		};
	}

	/**
	 * Voids a document the order no longer stands behind.
	 *
	 * @param invoiceId The document.
	 * @param reason Why, recorded on the document's internal note.
	 */
	public async voidDocument(invoiceId: ID, reason: string): Promise<void> {
		await this.invoiceService.update(invoiceId, {
			status: InvoiceStatusTypesEnum.VOID,
			internalNote: reason
		} as never);
	}

	/**
	 * Sends an estimate through the platform's estimate e-mail, and marks it sent when it went.
	 *
	 * The message is the one the finance screens send: the estimate's PDF, and the accept and decline links
	 * the estimate e-mail record carries. The language and the origin the links are built from are read off
	 * the request, exactly as the finance module's own field reads them, so the message is the same over
	 * either protocol. The send itself never raises — the finance service logs a failure and answers which
	 * step failed — and neither does this method: the quote it belongs to has already been recorded, so a
	 * send that could not be made is an outcome to report, not a write to undo.
	 *
	 * @param invoiceId The estimate.
	 * @param recipient The address it is sent to.
	 * @returns Whether the message was handed to the mail transport, and when it was not, why.
	 */
	public async sendEstimate(invoiceId: ID, recipient: string): Promise<IOrderEstimateDelivery> {
		try {
			const estimate = await this.invoiceService.findOneByIdString(invoiceId);
			const request = RequestContext.currentRequest() as { headers?: Record<string, unknown> } | null;
			const origin =
				typeof request?.headers?.['origin'] === 'string' ? (request.headers['origin'] as string) : undefined;
			const outcome = await this.invoiceService.sendEmail(
				RequestContext.getLanguageCode(),
				recipient,
				estimate.invoiceNumber,
				estimate.id,
				true,
				origin,
				estimate.organizationId
			);

			if (!outcome?.sent) {
				return { sent: false, recipient, reason: outcome?.reason ?? 'EMAIL_NOT_SENT' };
			}

			// The message went; a status the finance list then shows wrongly is not a reason to report it did not.
			await this.invoiceService
				.update(invoiceId, { status: EstimateStatusTypesEnum.SENT, sentTo: recipient } as never)
				.catch(() => undefined);

			return { sent: true, recipient };
		} catch {
			return { sent: false, recipient, reason: 'EMAIL_NOT_PREPARED' };
		}
	}
}
