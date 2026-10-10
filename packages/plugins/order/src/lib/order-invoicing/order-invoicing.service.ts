import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	HttpStatus,
	Inject,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
	Optional,
	ServiceUnavailableException
} from '@nestjs/common';
import { EstimateStatusTypesEnum, ID, OrderStatus, PermissionsEnum } from '@gauzy/contracts';
import {
	ApiErrorCode,
	ApiException,
	RequestContext,
	addDecimalStrings,
	compareDecimalStrings,
	subtractDecimalStrings
} from '@gauzy/core';
import { Order } from '../order/order.entity';
import { OrderService } from '../order/order.service';
import {
	ANY_ORDER_VERSION,
	IOrderEstimateDelivery,
	IOrderInvoiceDocument,
	IOrderInvoiceDocumentState,
	IOrderInvoiceDocumentItem,
	IOrderInvoiceIssued,
	IOrderInvoicingPort,
	ORDER_INVOICING,
	OrderLineInvoiceDirection,
	OrderLineKind,
	OrderVersionExpectation
} from '../order.types';
import { OrderHistoryService } from '../order-history/order-history.service';
import { scopeOfOrderRow } from '../order-history/order-row-scope';
import { OrderLineInvoice } from '../order-line-invoice/order-line-invoice.entity';
import { OrderLineInvoiceService } from '../order-line-invoice/order-line-invoice.service';
import { IOrderTotalsBreakdown, OrderTotalsService } from '../order-totals/order-totals.service';

/**
 * Why each status an order cannot be invoiced in is refused.
 *
 * Stated per status rather than as an allowed list alone, because a caller refused needs the reason as much
 * as the fact: a draft is not a sale yet, a cancelled order owes nothing, and an archived order is read-only.
 */
const NOT_INVOICEABLE: Partial<Record<OrderStatus, string>> = {
	[OrderStatus.DRAFT]:
		'a draft has not been placed, so nothing is owed yet — send it as a quote, or place it and invoice the placed order',
	[OrderStatus.CANCELED]: 'a cancelled order owes nothing, so there is nothing to bill',
	[OrderStatus.ARCHIVED]:
		'an archived order is read-only; it was put away without an invoice and is not reopened by one'
};

/** The statuses an order may be invoiced in: every placed status that still owes or owed money. */
export const ORDER_INVOICEABLE_STATUSES: OrderStatus[] = [
	OrderStatus.PENDING,
	OrderStatus.REQUIRES_ACTION,
	OrderStatus.CONFIRMED,
	OrderStatus.PROCESSING,
	OrderStatus.COMPLETED
];

/**
 * Why each status an order cannot be quoted in is refused.
 *
 * A quote is an offer the buyer answers before the order is agreed: a draft, or an order placed and not yet
 * confirmed. Accepting it is what confirms the order, so an order that is already confirmed, worked or
 * closed has nothing left to offer.
 */
const NOT_QUOTABLE: Partial<Record<OrderStatus, string>> = {
	[OrderStatus.REQUIRES_ACTION]:
		'the order is placed and waiting on its payment, and a quote is an offer made before the order is agreed',
	[OrderStatus.CONFIRMED]: 'the order is already agreed — a quote is an offer the buyer answers before that',
	[OrderStatus.PROCESSING]: 'the order is already agreed and being worked',
	[OrderStatus.COMPLETED]: 'the order is complete',
	[OrderStatus.CANCELED]: 'a cancelled order is not offered to anyone',
	[OrderStatus.ARCHIVED]: 'an archived order is read-only'
};

/** The statuses an order may be quoted in: before it is agreed. */
export const ORDER_QUOTABLE_STATUSES: OrderStatus[] = [OrderStatus.DRAFT, OrderStatus.PENDING];

/** What sending an order's quote answers. */
export interface IOrderQuoteSent {
	/** The order, stamped with its quote. */
	order: Order;
	/** The order's version, also published as the response's `ETag`. */
	version: number;
	/** The estimate the quote is. */
	quoteInvoiceId: ID;
	/** The estimate's number. */
	quoteNumber: number;
	/** Whether the estimate e-mail went, to whom, and when it did not, why. */
	delivery: IOrderEstimateDelivery;
}

/**
 * The bridge from an order to the accounting documents that bill it.
 *
 * An order is the commercial record; the invoice is the accounting document, and it lives in the
 * platform's finance tables, where the invoice list, the PDF, the payment register and the e-mail already
 * read it. This service builds that document from the order — every figure as the order's own totals
 * function computed it — and has it issued through the `ORDER_INVOICING` port, then stamps the order and
 * records which item billed which line. It never writes a finance table itself: the port's adapter does,
 * through the platform's own invoice service.
 *
 * **Each verb is version-predicated, like every other write of the order.** The stamp is committed by the
 * totals writer's conditional update under the version the caller stated; a caller that stated none is
 * held to the version this service read when it checked the order, so the check and the stamp cannot be
 * separated by another writer — two concurrent requests to invoice one order cannot both stamp it.
 *
 * **A document is never left standing for a write that was refused.** The document has to exist before the
 * order can name it, and the two are different tables owned by different packages, so they cannot share a
 * transaction. When the order's write — or the links recorded before it — is refused, the document that was
 * issued for it is voided (an accounting document keeps its number and is voided rather than removed) and
 * the links are withdrawn, and the refusal is answered.
 *
 * **The invoice keeps its own permission.** The route states the order grant (`ORDERS_EDIT`), which is what
 * the order package's two surfaces agree on; issuing the document additionally requires the finance
 * module's own grant (`INVOICES_EDIT`), because `order.permissions.ts` records that the accounting document
 * keeps its own permission and the platform's guard reads a route's grants as alternatives, never as a
 * conjunction.
 */
@Injectable()
export class OrderInvoicingService {
	constructor(
		private readonly orderService: OrderService,
		private readonly totalsService: OrderTotalsService,
		private readonly lineInvoiceService: OrderLineInvoiceService,
		private readonly historyService: OrderHistoryService,
		@Optional()
		@Inject(ORDER_INVOICING)
		private readonly invoicing?: IOrderInvoicingPort
	) {}

	/**
	 * Issues the invoice that bills an order, stamps the order with it and records the line links.
	 *
	 * The invoice bills the order as it stands: one item per billable line at the quantity ordered, one per
	 * delivery choice, the order's discount and tax as flat amounts, and its grand total. Each line's link
	 * records the item that billed it, the quantity and the item's amount, and carries the line's discount,
	 * tax and total in its metadata, so the register can say what the line was billed for without reading
	 * the document.
	 *
	 * @param orderId The order.
	 * @param expectation The version the caller read the order at.
	 * @returns The order, stamped with its invoice.
	 * @throws ForbiddenException when the caller lacks `INVOICES_EDIT`.
	 * @throws NotFoundException when the order is not the caller's.
	 * @throws ConflictException with `ORDER_ALREADY_INVOICED`, `ORDER_NOT_INVOICEABLE` or
	 * `ORDER_TEST_NOT_INVOICEABLE`.
	 * @throws BadRequestException with `ORDER_EMPTY` when no line can be billed.
	 * @throws ServiceUnavailableException with `ORDER_INVOICING_UNAVAILABLE` when no invoicing capability is
	 * registered.
	 */
	public async generateInvoice(
		orderId: ID,
		expectation: OrderVersionExpectation = ANY_ORDER_VERSION
	): Promise<Order> {
		this.assertDocumentGrant(PermissionsEnum.INVOICES_EDIT, 'an invoice');

		const order = await this.readOrder(orderId);

		if (order.invoiceId) {
			throw new ConflictException({
				message: `Order ${order.number} is already invoiced by ${order.invoiceId}; an order is invoiced once, and a correction is a credit note against that invoice.`,
				code: 'ORDER_ALREADY_INVOICED',
				details: { orderId: order.id, invoiceId: order.invoiceId }
			});
		}

		if (order.isTest) {
			throw new ConflictException({
				message: `Order ${order.number} is a test order, and a test order is excluded from the invoice bridge.`,
				code: 'ORDER_TEST_NOT_INVOICEABLE',
				details: { orderId: order.id }
			});
		}

		if (!ORDER_INVOICEABLE_STATUSES.includes(order.status)) {
			const reason = NOT_INVOICEABLE[order.status] ?? `an order in ${order.status} cannot be invoiced`;

			throw new ConflictException({
				message: `Order ${order.number} is ${order.status} and cannot be invoiced: ${reason}.`,
				code: 'ORDER_NOT_INVOICEABLE',
				details: { orderId: order.id, status: order.status, reason, invoiceable: ORDER_INVOICEABLE_STATUSES }
			});
		}

		const invoicing = this.requireInvoicing();
		// Taken before anything is issued: the stamp is decided from this read, so it is held to this read.
		const heldTo = this.heldTo(order, expectation);
		const { document, billedLines } = await this.documentOf(order, false);
		const issued = await invoicing.issue(document);
		const links: OrderLineInvoice[] = [];
		let invoiced: Order;

		try {
			for (const item of document.items.filter((candidate) => billedLines.has(candidate.key))) {
				const figures = billedLines.get(item.key);
				const { link } = await this.lineInvoiceService.record({
					orderLineId: item.key,
					invoiceItemId: this.itemOf(issued, item.key),
					direction: OrderLineInvoiceDirection.INVOICE,
					quantity: item.quantity,
					amount: item.totalValue,
					currency: order.currency,
					metadata: {
						source: 'ORDER_INVOICE',
						invoiceId: issued.invoiceId,
						invoiceNumber: issued.invoiceNumber,
						discount: figures?.discount,
						tax: figures?.tax,
						lineTotal: figures?.total
					}
				});

				links.push(link);
			}

			// Held to the version this service read when it found the order uninvoiced, unless the caller stated
			// one: the conditional update is then what refuses a second request that read the same order.
			invoiced = await this.totalsService.recompute(order.id, 'INVOICED', {
				expectation: heldTo,
				patch: { invoiceId: issued.invoiceId }
			});
		} catch (error) {
			await this.withdraw(
				issued,
				links,
				`Voided: the order write it was issued for was refused (order ${order.number}).`
			);

			throw error;
		}

		await this.historyService.record(
			order.id,
			'ORDER_INVOICED',
			'Order invoiced',
			{ invoiceId: issued.invoiceId, invoiceNumber: issued.invoiceNumber },
			scopeOfOrderRow(order)
		);

		return invoiced;
	}

	/**
	 * Sends the buyer a quote for an order: the platform's own estimate, built from the order, e-mailed with
	 * its accept and decline links.
	 *
	 * **Sending always quotes the order as it stands.** The estimate is built afresh from the order's figures
	 * and the order's `quoteInvoiceId` is moved to it; an earlier quote the buyer has not answered is voided as
	 * superseded, so there is never more than one open offer for one order. One the buyer declined is left as
	 * it is, because it records the buyer's answer.
	 *
	 * **The quote is recorded whether or not the e-mail goes.** The estimate and the stamp are the write; the
	 * e-mail is a delivery of it, and an installation with no mail server must still be able to quote — so a
	 * send that could not be made is reported in `delivery` rather than failing the write, and the quote can
	 * be sent again.
	 *
	 * @param orderId The order.
	 * @param expectation The version the caller read the order at.
	 * @returns The order, the estimate the quote is, and whether the e-mail went.
	 * @throws ForbiddenException when the caller lacks `ESTIMATES_EDIT`.
	 * @throws NotFoundException when the order is not the caller's.
	 * @throws ConflictException with `ORDER_NOT_QUOTABLE`, `ORDER_ALREADY_INVOICED` or
	 * `ORDER_QUOTE_ALREADY_ACCEPTED`.
	 * @throws BadRequestException with `ORDER_EMPTY` when no line can be quoted.
	 * @throws ServiceUnavailableException with `ORDER_INVOICING_UNAVAILABLE` when no invoicing capability is
	 * registered.
	 */
	public async sendQuote(
		orderId: ID,
		expectation: OrderVersionExpectation = ANY_ORDER_VERSION
	): Promise<IOrderQuoteSent> {
		this.assertDocumentGrant(PermissionsEnum.ESTIMATES_EDIT, 'a quote');

		const order = await this.readOrder(orderId);

		if (!ORDER_QUOTABLE_STATUSES.includes(order.status)) {
			const reason = NOT_QUOTABLE[order.status] ?? `an order in ${order.status} cannot be quoted`;

			throw new ConflictException({
				message: `Order ${order.number} is ${order.status} and cannot be quoted: ${reason}.`,
				code: 'ORDER_NOT_QUOTABLE',
				details: { orderId: order.id, status: order.status, reason, quotable: ORDER_QUOTABLE_STATUSES }
			});
		}

		if (order.invoiceId) {
			throw new ConflictException({
				message: `Order ${order.number} is already invoiced by ${order.invoiceId}, so it is past being quoted.`,
				code: 'ORDER_ALREADY_INVOICED',
				details: { orderId: order.id, invoiceId: order.invoiceId }
			});
		}

		const invoicing = this.requireInvoicing();
		const heldTo = this.heldTo(order, expectation);
		const previous = order.quoteInvoiceId ? await invoicing.read(order.quoteInvoiceId) : null;

		if (previous?.isAccepted === true) {
			throw new ConflictException({
				message: `The quote for order ${order.number} was accepted; the accepted quote is the agreement, and a new one is not sent over it.`,
				code: 'ORDER_QUOTE_ALREADY_ACCEPTED',
				details: { orderId: order.id, quoteInvoiceId: previous.invoiceId }
			});
		}

		const { document } = await this.documentOf(order, true);
		const issued = await invoicing.issue(document);
		let quoted: Order;

		try {
			quoted = await this.totalsService.recompute(order.id, 'QUOTE_SENT', {
				expectation: heldTo,
				patch: { quoteInvoiceId: issued.invoiceId }
			});
		} catch (error) {
			await this.withdraw(
				issued,
				[],
				`Voided: the order write it was issued for was refused (order ${order.number}).`
			);

			throw error;
		}

		const superseded = previous && this.isOpenEstimate(previous) ? previous.invoiceId : undefined;

		if (superseded) {
			const reason = `Voided: superseded by quote ${issued.invoiceNumber} for order ${order.number}.`;

			await invoicing.voidDocument(superseded, reason).catch(() => undefined);
		}

		const delivery = await this.deliver(invoicing, issued.invoiceId, order.email);

		await this.historyService.record(
			order.id,
			'ORDER_QUOTE_SENT',
			'Quote sent',
			{
				quoteInvoiceId: issued.invoiceId,
				quoteNumber: issued.invoiceNumber,
				supersededQuoteInvoiceId: superseded ?? null,
				sent: delivery.sent,
				recipient: delivery.recipient ?? null,
				reason: delivery.reason ?? null
			},
			scopeOfOrderRow(order)
		);

		return {
			order: quoted,
			version: Number(quoted.version),
			quoteInvoiceId: issued.invoiceId,
			quoteNumber: issued.invoiceNumber,
			delivery
		};
	}

	/**
	 * Records the buyer's acceptance of an order's quote and confirms the order.
	 *
	 * The estimate is marked accepted — the finance document's own accept flag — and the order is moved to
	 * `CONFIRMED` **through the order's own lifecycle**: a draft is placed first (`DRAFT -> PENDING`, the move
	 * `placeOrder` makes, with its number and stock commitment) and then confirmed (`PENDING -> CONFIRMED`, the
	 * move the approve route makes), because `DRAFT -> CONFIRMED` is not a move the state machine contains.
	 * Every rule those moves carry applies: an order with nothing to sell is not placed, and an order whose
	 * money question is open or that has a change awaiting approval is not confirmed.
	 *
	 * **The answer is recorded first, and the order follows it.** The buyer's acceptance is a fact once it is
	 * given; the order's moves are version-predicated writes that can be refused — by another writer, or by a
	 * rule. A refused move leaves the quote accepted and the order where the moves stopped, and the same call
	 * made again (with the order's new version) completes it, because an estimate already accepted is not
	 * answered twice.
	 *
	 * @param orderId The order.
	 * @param expectation The version the caller read the order at.
	 * @returns The confirmed order.
	 * @throws ForbiddenException when the caller lacks `ESTIMATES_EDIT`.
	 * @throws NotFoundException when the order is not the caller's.
	 * @throws ConflictException with `ORDER_QUOTE_NOT_ANSWERABLE`, `ORDER_QUOTE_NOT_SENT`,
	 * `ORDER_QUOTE_DECLINED` or `ORDER_QUOTE_VOID`.
	 * @throws BadRequestException with `ORDER_STATUS_TRANSITION_INVALID` or `ORDER_EMPTY` when the order's
	 * lifecycle refuses the move.
	 * @throws ServiceUnavailableException with `ORDER_INVOICING_UNAVAILABLE` when no invoicing capability is
	 * registered.
	 */
	public async acceptQuote(orderId: ID, expectation: OrderVersionExpectation = ANY_ORDER_VERSION): Promise<Order> {
		this.assertDocumentGrant(PermissionsEnum.ESTIMATES_EDIT, 'the answer to a quote');

		const order = await this.readOrder(orderId);
		const { invoicing, quote } = await this.answerableQuote(order);

		if (quote.isAccepted === false || quote.status === EstimateStatusTypesEnum.REJECTED) {
			throw new ConflictException({
				message: `The quote for order ${order.number} was declined; send a new quote to make another offer.`,
				code: 'ORDER_QUOTE_DECLINED',
				details: { orderId: order.id, quoteInvoiceId: quote.invoiceId }
			});
		}

		const heldTo = this.heldTo(order, expectation);

		if (quote.isAccepted !== true) {
			await invoicing.answerEstimate(quote.invoiceId, true);
			await this.historyService.record(
				order.id,
				'ORDER_QUOTE_ACCEPTED',
				'Quote accepted',
				{ quoteInvoiceId: quote.invoiceId, quoteNumber: quote.invoiceNumber ?? null },
				scopeOfOrderRow(order)
			);
		}

		// A draft is placed first, under the version the caller stated; the confirmation is then held to the
		// version the placement produced, so nothing can land between the two moves.
		let confirmUnder = heldTo;

		if (order.status === OrderStatus.DRAFT) {
			const placed = await this.orderService.place(order.id, { quoteInvoiceId: quote.invoiceId }, heldTo);

			confirmUnder = { wildcard: false, versions: [Number(placed.version)] };
		}

		return this.orderService.confirm(order.id, 'STAFF', confirmUnder);
	}

	/**
	 * Records the buyer's refusal of an order's quote.
	 *
	 * The estimate is marked declined — the finance document's own accept flag set to false, its status
	 * REJECTED — and **the order is left where it is: a draft stays a draft**, and a placed order stays
	 * placed. A declined offer is not a cancelled order; the seller may revise the order and send a new quote,
	 * which leaves this one as the record of the buyer's answer.
	 *
	 * **It is version-predicated like every write of the order.** The order's own write — which moves no
	 * status and changes no column, and whose summary row records `QUOTE_DECLINED` as the reason the version
	 * advanced — is committed first, under the version the caller stated, so a decline reasoned about from an
	 * order that has moved on is refused with nothing written. The estimate is answered after it; a failure
	 * there leaves the quote open, and the same call made again (with the order's new version) declines it.
	 *
	 * @param orderId The order.
	 * @param reason Why the buyer declined, recorded on the order's timeline.
	 * @param expectation The version the caller read the order at.
	 * @returns The order, at its new version and in the status it was in.
	 * @throws ForbiddenException when the caller lacks `ESTIMATES_EDIT`.
	 * @throws NotFoundException when the order is not the caller's.
	 * @throws ConflictException with `ORDER_QUOTE_NOT_ANSWERABLE`, `ORDER_QUOTE_NOT_SENT`, `ORDER_QUOTE_VOID`,
	 * `ORDER_QUOTE_ALREADY_ACCEPTED` or `ORDER_QUOTE_ALREADY_DECLINED`.
	 * @throws ServiceUnavailableException with `ORDER_INVOICING_UNAVAILABLE` when no invoicing capability is
	 * registered.
	 */
	public async declineQuote(
		orderId: ID,
		reason?: string,
		expectation: OrderVersionExpectation = ANY_ORDER_VERSION
	): Promise<Order> {
		this.assertDocumentGrant(PermissionsEnum.ESTIMATES_EDIT, 'the answer to a quote');

		const order = await this.readOrder(orderId);
		const { invoicing, quote } = await this.answerableQuote(order);

		if (quote.isAccepted === true) {
			throw new ConflictException({
				message: `The quote for order ${order.number} was accepted, and an accepted quote is not declined afterwards.`,
				code: 'ORDER_QUOTE_ALREADY_ACCEPTED',
				details: { orderId: order.id, quoteInvoiceId: quote.invoiceId }
			});
		}

		if (quote.isAccepted === false || quote.status === EstimateStatusTypesEnum.REJECTED) {
			throw new ConflictException({
				message: `The quote for order ${order.number} was already declined.`,
				code: 'ORDER_QUOTE_ALREADY_DECLINED',
				details: { orderId: order.id, quoteInvoiceId: quote.invoiceId }
			});
		}

		const declined = await this.totalsService.recompute(order.id, 'QUOTE_DECLINED', {
			expectation: this.heldTo(order, expectation)
		});

		await invoicing.answerEstimate(quote.invoiceId, false);
		await this.historyService.record(
			order.id,
			'ORDER_QUOTE_DECLINED',
			'Quote declined',
			{ quoteInvoiceId: quote.invoiceId, quoteNumber: quote.invoiceNumber ?? null, reason: reason ?? null },
			scopeOfOrderRow(order)
		);

		return declined;
	}

	/*
	|--------------------------------------------------------------------------
	| The document
	|--------------------------------------------------------------------------
	*/

	/**
	 * Builds the document an order issues, every figure as the order's totals function computed it.
	 *
	 * One item per billable line — an `ITEM` line with a quantity; a section, a note or a line of nothing
	 * carries no value to bill — and one per delivery choice. The items, less the discount, plus the tax, are
	 * checked against the order's grand total before anything is issued: a document that did not add up to
	 * the order would bill the buyer something other than what they agreed to.
	 *
	 * @param order The order.
	 * @param isEstimate Whether the document is the estimate a quote sends.
	 * @returns The document, and the figures of each billed line under its key.
	 * @throws BadRequestException with `ORDER_EMPTY` when no line can be billed.
	 * @throws InternalServerErrorException with `ORDER_DOCUMENT_UNSETTLED` when the items do not add up.
	 */
	private async documentOf(
		order: Order,
		isEstimate: boolean
	): Promise<{ document: IOrderInvoiceDocument; billedLines: Map<ID, IOrderTotalsBreakdown['lines'][number]> }> {
		const breakdown = await this.totalsService.computeBreakdown(order);
		const billable = breakdown.lines.filter(
			(part) =>
				(part.line.kind ?? OrderLineKind.ITEM) === OrderLineKind.ITEM &&
				compareDecimalStrings(part.quantity, '0') > 0
		);

		if (!billable.length) {
			throw new BadRequestException(
				`ORDER_EMPTY: order ${order.number} has no line with a quantity to bill, so no document can be issued for it.`
			);
		}

		const items: IOrderInvoiceDocumentItem[] = [
			...billable.map((part) => ({
				key: part.line.id,
				description: part.line.sku ? `${part.line.title} (${part.line.sku})` : part.line.title,
				quantity: part.quantity,
				unitPrice: part.unitPrice,
				totalValue: part.subtotal,
				productId: part.line.productId ?? undefined,
				applyTax: compareDecimalStrings(part.tax, '0') !== 0,
				applyDiscount: compareDecimalStrings(part.discount, '0') !== 0
			})),
			...breakdown.shippingMethods.map((part) => ({
				key: part.method.id,
				description: part.method.name || 'Shipping',
				quantity: '1',
				unitPrice: part.amount,
				totalValue: part.subtotal,
				applyTax: compareDecimalStrings(part.tax, '0') !== 0,
				applyDiscount: compareDecimalStrings(part.discount, '0') !== 0
			}))
		];

		const { discountTotal, grandTotal } = breakdown.exactTotals;
		const taxTotal = addDecimalStrings(breakdown.exactTotals.taxTotal, breakdown.exactTotals.shippingTaxTotal);
		const billed = items.reduce<string>((sum, item) => addDecimalStrings(sum, item.totalValue), '0');

		if (
			compareDecimalStrings(
				addDecimalStrings(subtractDecimalStrings(billed, discountTotal), taxTotal),
				grandTotal
			) !== 0
		) {
			throw new InternalServerErrorException(
				`ORDER_DOCUMENT_UNSETTLED: the items of order ${order.number} sum to ${billed}, which less ${discountTotal} ` +
					`and plus ${taxTotal} is not the grand total ${grandTotal}; nothing was issued.`
			);
		}

		return {
			document: {
				isEstimate,
				tenantId: order.tenantId ?? undefined,
				organizationId: order.organizationId,
				currency: order.currency,
				contactId: order.customerId ?? undefined,
				sentTo: order.email ?? undefined,
				paymentTermId: order.paymentTermId ?? undefined,
				reference: order.number,
				discountTotal,
				taxTotal,
				grandTotal,
				items
			},
			billedLines: new Map(billable.map((part) => [part.line.id, part]))
		};
	}

	/*
	|--------------------------------------------------------------------------
	| Helpers
	|--------------------------------------------------------------------------
	*/

	/**
	 * @param orderId The order.
	 * @returns The order, read through the tenant-aware service, so another tenant's order is not found.
	 * @throws NotFoundException when the caller's tenant has no such order.
	 */
	private async readOrder(orderId: ID): Promise<Order> {
		const order = await this.orderService.findOneByIdString(orderId);

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${orderId}.`);
		}

		return order;
	}

	/**
	 * @returns The invoicing capability.
	 * @throws ServiceUnavailableException with `ORDER_INVOICING_UNAVAILABLE` when the installation did not
	 * register one — before anything is written.
	 */
	private requireInvoicing(): IOrderInvoicingPort {
		if (!this.invoicing) {
			throw new ServiceUnavailableException(
				'ORDER_INVOICING_UNAVAILABLE: the invoicing capability is not registered in this process, so no invoice or quote can be issued for an order.'
			);
		}

		return this.invoicing;
	}

	/**
	 * Requires the finance module's own grant beside the order grant the route states.
	 *
	 * @param permission The grant the accounting document requires.
	 * @param what The document, for the refusal.
	 * @throws ForbiddenException when the caller lacks it.
	 */
	private assertDocumentGrant(permission: PermissionsEnum, what: string): void {
		if (!RequestContext.hasPermission(permission)) {
			throw new ForbiddenException(
				`ORDER_DOCUMENT_FORBIDDEN: issuing ${what} writes an accounting document, which needs ${permission} as well as the order grant.`
			);
		}
	}

	/**
	 * The version an order write is held to — checked against the order as read, before anything is written.
	 *
	 * The verbs here write a finance document before the order's own conditional update, so a version that
	 * is already stale is refused at once rather than discovered by the update after a document was issued
	 * for it. The conditional update still decides the race that remains between this read and that write.
	 *
	 * @param order The order as this service read it.
	 * @param expectation The version the caller stated.
	 * @returns The caller's statement; or, when the caller stated none, the version this service read — so a
	 * write decided from that read cannot land on an order another writer has moved since.
	 * @throws ApiException with `ENTITY_VERSION_CONFLICT` when the caller stated versions the order is not at.
	 */
	private heldTo(order: Order, expectation: OrderVersionExpectation): OrderVersionExpectation {
		if (!expectation || expectation.wildcard) {
			return { wildcard: false, versions: [Number(order.version)] };
		}

		const stated = (expectation.versions ?? []).map(Number);

		if (stated.length && !stated.includes(Number(order.version))) {
			throw new ApiException(
				HttpStatus.CONFLICT,
				ApiErrorCode.ENTITY_VERSION_CONFLICT,
				'The record changed since you read it. Read it again and reapply your change.',
				{ expectedVersion: stated.length === 1 ? stated[0] : stated, actualVersion: Number(order.version) }
			);
		}

		return expectation;
	}

	/**
	 * The order's quote, when the order is in a state that can answer one.
	 *
	 * @param order The order.
	 * @returns The invoicing capability, and the quote as it reads it.
	 * @throws ConflictException with `ORDER_QUOTE_NOT_ANSWERABLE` when the order is past quoting,
	 * `ORDER_QUOTE_NOT_SENT` when it has no quote, and `ORDER_QUOTE_VOID` when its quote was voided.
	 * @throws ServiceUnavailableException with `ORDER_INVOICING_UNAVAILABLE`.
	 */
	private async answerableQuote(
		order: Order
	): Promise<{ invoicing: IOrderInvoicingPort; quote: IOrderInvoiceDocumentState }> {
		if (!ORDER_QUOTABLE_STATUSES.includes(order.status)) {
			const reason = NOT_QUOTABLE[order.status] ?? `an order in ${order.status} has no open quote`;

			throw new ConflictException({
				message: `Order ${order.number} is ${order.status}, so its quote can no longer be answered: ${reason}.`,
				code: 'ORDER_QUOTE_NOT_ANSWERABLE',
				details: { orderId: order.id, status: order.status, reason, answerable: ORDER_QUOTABLE_STATUSES }
			});
		}

		const invoicing = this.requireInvoicing();
		const quote = order.quoteInvoiceId ? await invoicing.read(order.quoteInvoiceId) : null;

		if (!quote || !quote.isEstimate) {
			throw new ConflictException({
				message: `Order ${order.number} has no quote to answer; send one first.`,
				code: 'ORDER_QUOTE_NOT_SENT',
				details: { orderId: order.id, quoteInvoiceId: order.quoteInvoiceId ?? null }
			});
		}

		if (quote.status === EstimateStatusTypesEnum.VOID) {
			throw new ConflictException({
				message: `The quote for order ${order.number} was voided, so it can no longer be answered.`,
				code: 'ORDER_QUOTE_VOID',
				details: { orderId: order.id, quoteInvoiceId: quote.invoiceId }
			});
		}

		return { invoicing, quote };
	}

	/**
	 * @param estimate An estimate as the invoicing capability reads it.
	 * @returns Whether the buyer has yet to answer it and it still stands.
	 */
	private isOpenEstimate(estimate: IOrderInvoiceDocumentState): boolean {
		return (
			(estimate.isAccepted === null || estimate.isAccepted === undefined) &&
			estimate.status !== EstimateStatusTypesEnum.VOID &&
			estimate.status !== EstimateStatusTypesEnum.REJECTED
		);
	}

	/**
	 * Sends an estimate, reporting rather than raising.
	 *
	 * @param invoicing The invoicing capability.
	 * @param invoiceId The estimate.
	 * @param recipient The buyer's e-mail, when the order carries one.
	 * @returns Whether the e-mail went, to whom, and when it did not, why.
	 */
	private async deliver(
		invoicing: IOrderInvoicingPort,
		invoiceId: ID,
		recipient: string | undefined
	): Promise<IOrderEstimateDelivery> {
		if (!recipient) {
			return { sent: false, reason: 'NO_RECIPIENT' };
		}

		try {
			return await invoicing.sendEstimate(invoiceId, recipient);
		} catch {
			return { sent: false, recipient, reason: 'EMAIL_NOT_PREPARED' };
		}
	}

	/**
	 * @param issued The issued document.
	 * @param key The order line or delivery choice.
	 * @returns The item the key became.
	 */
	private itemOf(issued: IOrderInvoiceIssued, key: ID): ID {
		const item = issued.items.find((candidate) => candidate.key === key);

		if (!item) {
			throw new InternalServerErrorException(
				`ORDER_INVOICE_ITEMS_UNMATCHED: document ${issued.invoiceId} carries no item for ${key}.`
			);
		}

		return item.invoiceItemId;
	}

	/**
	 * Withdraws what was written for a document whose order write was refused: the links are retired, which
	 * re-derives each line's counters, and the document is voided.
	 *
	 * A failure here is not allowed to replace the refusal the caller is answered with — that refusal is the
	 * fact the caller acts on — so each step is attempted on its own.
	 *
	 * @param issued The document.
	 * @param links The links recorded for it.
	 * @param reason Why the document is voided.
	 */
	private async withdraw(issued: IOrderInvoiceIssued, links: OrderLineInvoice[], reason: string): Promise<void> {
		for (const link of links) {
			await this.lineInvoiceService.delete(link.id).catch(() => undefined);
		}

		await this.invoicing?.voidDocument(issued.invoiceId, reason).catch(() => undefined);
	}
}
