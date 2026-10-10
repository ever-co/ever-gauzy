import { DeepPartial } from 'typeorm';
import { DecimalString, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity, versionExpectationOf } from '@gauzy/core';

/**
 * A record as a caller supplies it: the entity's own columns, plus the tenancy columns the base entity
 * carries and a create or update call may state. The columns are declared by the base class, so they
 * are named here and never redeclared by a table.
 */
export type OrderWriteInput<T> = DeepPartial<T> & Partial<TenantOrganizationBaseEntity>;

/**
 * The version a caller accepted for a write, as the concurrency kernel states it.
 *
 * Taken from the reader that produces it rather than restated here, so the shape the kernel leaves on
 * a request and the shape this package hands back to the version-predicated update cannot drift apart.
 * A route reads it with `versionExpectationOf(request)`; a caller inside the package states
 * {@link ANY_ORDER_VERSION} when no client version is behind the write.
 */
export type OrderVersionExpectation = ReturnType<typeof versionExpectationOf>;

/**
 * The version a write that no caller conditioned on is predicated on.
 *
 * A route is predicated on the version its caller stated, so a change reasoned about from an order
 * that has moved on is refused instead of applied. A write that arrives from anywhere else — the
 * checkout path that places the order a cart became, the change confirmation, the staleness sweep —
 * has no caller to condition it and is predicated on the version the row holds when the statement
 * runs. Either way the comparison and the increment are one statement, so no write in this package is
 * a last-writer-wins write.
 */
export const ANY_ORDER_VERSION: OrderVersionExpectation = { wildcard: true, versions: [] };

/**
 * The token the service that owns an order row is reachable under.
 *
 * `OrderTotalsService` commits every write of the order aggregate, and the service that owns the row
 * is `OrderService` — which is constructed *from* the totals service and therefore cannot be injected
 * into it without closing a dependency cycle the container cannot express. The token is resolved
 * through `ModuleRef` at the moment of a write instead, which is the same route the concurrency
 * kernel's own guard takes to the service a route names.
 */
export const ORDER_AGGREGATE_WRITER = 'ORDER_AGGREGATE_WRITER';

/**
 * The aggregate name every `order.*` outbox row is written under.
 *
 * The outbox partitions by `<aggregateType>:<aggregateId>` and promises ordering inside a partition
 * and nowhere else, so this string is what makes "the events of one order arrive in the order they
 * happened" true. It is a constant rather than a literal at each call site for exactly that reason: a
 * single mistyped value would put one of an order's events in a partition of its own, where the
 * dispatcher would be free to deliver it before the event that preceded it.
 */
export const ORDER_AGGREGATE_TYPE = 'ORDER';

/**
 * The `order.*` facts this package announces.
 *
 * The README states that observable changes leave through the core `event_outbox`, and these are the
 * changes: an order is placed, confirmed, cancelled, completed or archived. They are the lifecycle
 * moves — not every write — because an event is a fact another context acts on, and a totals refresh
 * is not one. Naming them here rather than inline keeps the set answerable: a webhook subscriber that
 * asks what it may subscribe to has one place to read, and a consumer registered for `order.*` gets
 * exactly these.
 */
export const ORDER_EVENTS = {
	/** A draft became a real order: its number is final and its stock is committed. */
	PLACED: 'order.placed',
	/** The money question is answered and the order may be worked. */
	CONFIRMED: 'order.confirmed',
	/** The order will not be fulfilled. */
	CANCELED: 'order.canceled',
	/** Every line is accounted for and nothing is outstanding. */
	COMPLETED: 'order.completed',
	/** A terminal order was put away; it is read-only from here. */
	ARCHIVED: 'order.archived'
} as const;

/**
 * What kind of line this is.
 *
 * A closed set that genuinely does not grow, so it is an enumeration and not a lookup table. Before
 * it, a quotation needing a heading had to be modelled as a fake product line — which then entered the
 * invoice, the fulfilment and the totals. A non-`ITEM` row carries no quantity, no price and no
 * product, and `ITEM` is what every row that existed before this revision is.
 */
export enum OrderLineKind {
	/** A real line: priced, fulfilled, invoiced. */
	ITEM = 'ITEM',
	/** A presentation heading. Never enters fulfilment and never appears on an invoice item. */
	SECTION = 'SECTION',
	/** A free-text line between items, with the same exclusions as a section. */
	NOTE = 'NOTE'
}

/**
 * How much of a line has been billed.
 *
 * **Derived**, never authored: it follows from the variant's billing policy and the line's two
 * counters, and it is stored because it is the column a listing filters on. `OVER_INVOICED` is legal
 * and named rather than silently impossible, for the same reason the over-delivery counter exists.
 */
export enum OrderLineInvoiceStatus {
	/** Nothing has been billed against the line. */
	NOT_INVOICED = 'NOT_INVOICED',
	/** Some, but less than the basis, has been billed — a deposit, or the first milestone. */
	PARTIALLY_INVOICED = 'PARTIALLY_INVOICED',
	/** The basis quantity has been billed in full. */
	INVOICED = 'INVOICED',
	/** More than the basis has been billed. */
	OVER_INVOICED = 'OVER_INVOICED'
}

/**
 * Which way one line-to-invoice link moves the counters.
 *
 * A closed two-value set. A credit note is not a second kind of document here: it is the same link
 * with the opposite direction, which is what makes "what did this credit note credit?" a question the
 * schema answers instead of one reconstructed from a JSON array.
 */
export enum OrderLineInvoiceDirection {
	/** A positive invoice item that bills part of the line. */
	INVOICE = 'INVOICE',
	/** A negative credit-note item that credits part of the line. */
	CREDIT = 'CREDIT'
}

/**
 * What one order line reports to a caller that does not own the order.
 *
 * A post-purchase flow — taking goods back, claiming about them, sending a replacement — happens
 * after the order was placed, in a package that owns none of the order's columns. It needs two
 * facts about a line and neither of them is its own: how much of the line actually left the
 * building, which is the ceiling such a flow is measured against, and the price the line was sold
 * at, which is what the flow values the goods at. The second is the line's **snapshot**, not
 * today's catalogue price: a customer who paid one price is not credited at another.
 *
 * Both are exact decimals rather than numbers, because the caller compares quantities against the
 * ceiling and multiplies the price into an amount, and a floating-point comparison near the ceiling
 * is exactly where a wrong answer costs money.
 *
 * **A line with nothing fulfilled on it is not reported at all.** The report is the set of lines a
 * post-purchase flow may act on, so the absence of a line is the answer to "may this be returned or
 * claimed about?" — a flow that asked about a line which never shipped is told that no such
 * fulfilled line exists, rather than being handed a zero it would have to interpret.
 */
export interface IOrderLineFulfillment {
	/** The order line. */
	readonly orderLineId: ID;
	/** Variant the line is for, when the line names one. */
	readonly variantId?: ID;
	/** Quantity fulfilled and not cancelled: the sum of the line's fulfilment rows that stand. */
	readonly fulfilledQuantity: DecimalString;
	/** Price one unit was sold at, exact. */
	readonly unitPrice?: DecimalString;
}

/**
 * One movement of an order line's received-return counter, as a post-purchase flow states it.
 *
 * The counter is `order_line.returnReceivedQuantity`: the goods half of a return, and one of the five
 * sums `deriveFulfillmentStatus` reads to decide between `PARTIALLY_RETURNED` and `RETURNED`. It is
 * declared here as the shape the order package accepts rather than imported from the package that
 * sends it, for the same reason {@link IOrderLineFulfillment} is: the caller and this package share a
 * contract, not a module.
 */
export interface IOrderLineReceiptMove {
	/** The order line the goods belong to. */
	readonly orderLineId: ID;
	/** How much this delivery moves the counter: positive on a receipt, negative when one is undone. */
	readonly quantityDelta: DecimalString;
}

/**
 * How far back the order-totals reconciliation looks for an order to examine.
 *
 * The window is what makes the sweep a sweep rather than a full-table pass: an order whose ledgers
 * moved more than a week ago and whose status is stale is a fact nothing in the running system
 * still depends on, and widening the window would trade a bounded read for a pass over every order
 * the installation has ever taken. Seven days is the window the ADR's "orders touched in the last N
 * days" leaves open, and it is chosen against the number the check it feeds is about: everything
 * that moves an order's ledgers — a transaction, a fulfilment, a return, a claim, an exchange —
 * writes the order row through the totals writer, so an order the check still has to repair is one
 * that moved inside this window.
 */
export const ORDER_TOTALS_AUDIT_WINDOW_DAYS = 7;

/**
 * The reason the reconciliation records on the summary row of an order it repaired.
 *
 * `order_summary.reason` is a fact the next reader interprets, so a repair writes a reason of its
 * own rather than borrowing the move that should have made it: `PLACED` on a row written a week
 * after the placement would say the placement wrote it, and the whole value of the row is that it
 * says which move committed that version.
 */
export const ORDER_TOTALS_RECONCILED_REASON = 'DRIFT_REPAIRED';

/**
 * How long a change may sit unapplied before the staleness sweep cancels it.
 *
 * An open change occupies an order's exclusivity slot, so this number is the answer to "how long
 * may one operator's abandoned request keep every other caller out of the order?" — and the sweep
 * that reads it is the only thing that ever gives the slot back.
 */
export const ORDER_CHANGE_STALE_HOURS = 24;

/*
|--------------------------------------------------------------------------
| The accounting document an order issues
|--------------------------------------------------------------------------
*/

/**
 * One item of the accounting document an order issues: one billable order line, or one delivery choice.
 *
 * Every figure is the exact decimal text the order computed, never a number: the item is written into a
 * `numeric` column of the finance table, and a value that crossed a `number` on its way there would be
 * a figure the order never stated.
 */
export interface IOrderInvoiceDocumentItem {
	/** What the order calls the item: the order line's id, or the delivery choice's. Echoed back with the item it became. */
	readonly key: ID;
	/** What the item reads as on the document. */
	readonly description: string;
	/** The quantity billed. */
	readonly quantity: DecimalString;
	/** The price one unit was sold at, as the line's snapshot holds it — gross when the line is priced tax-inclusive. */
	readonly unitPrice: DecimalString;
	/** The item's subtotal as the order computed it: net of any tax its price contained, fees included, before discount. */
	readonly totalValue: DecimalString;
	/** The product the line sold, when it names one. */
	readonly productId?: ID;
	/** Whether the order taxed the item. */
	readonly applyTax: boolean;
	/** Whether the order discounted the item. */
	readonly applyDiscount: boolean;
}

/**
 * The accounting document an order issues: an invoice, or — `isEstimate` — the estimate a quote is.
 *
 * The discount and the tax are stated as the flat amounts the order computed rather than re-derived by the
 * document from rates: the order is the record that decided them, and a document that recomputed them
 * could arrive at a different total than the one the buyer agreed to.
 */
export interface IOrderInvoiceDocument {
	/** True for the estimate a quote sends, false for the invoice that bills the order. */
	readonly isEstimate: boolean;
	/** The order's tenant, which the document is written under. */
	readonly tenantId?: ID;
	/** The order's organization: the issuer of the document and the organization it is filed in. */
	readonly organizationId: ID;
	/** The order's currency. */
	readonly currency: string;
	/** The buyer, an `organization_contact`, when the order names one. */
	readonly contactId?: ID;
	/** The buyer's e-mail, when the order carries one. */
	readonly sentTo?: string;
	/** The settlement schedule the order was placed against. */
	readonly paymentTermId?: ID;
	/** The order's number, which the document states as its provenance. */
	readonly reference: string;
	/** The order's discount total, as a positive magnitude. */
	readonly discountTotal: DecimalString;
	/** The order's tax: the item tax and the shipping tax together. */
	readonly taxTotal: DecimalString;
	/** The order's grand total: the items, less the discount, plus the tax. */
	readonly grandTotal: DecimalString;
	/** The items, in the order they are listed. */
	readonly items: readonly IOrderInvoiceDocumentItem[];
}

/** The document the invoicing capability issued. */
export interface IOrderInvoiceIssued {
	/** The `invoice` row that was written. */
	readonly invoiceId: ID;
	/** The number the document was given. */
	readonly invoiceNumber: number;
	/** Each item the document carries, under the key the order stated for it. */
	readonly items: ReadonlyArray<{ readonly key: ID; readonly invoiceItemId: ID }>;
}

/** What the order reads back about a document it issued. */
export interface IOrderInvoiceDocumentState {
	/** The `invoice` row. */
	readonly invoiceId: ID;
	/** The number the document carries. */
	readonly invoiceNumber?: number;
	/** Whether the document is an estimate. */
	readonly isEstimate: boolean;
	/** The buyer's answer to an estimate: true accepted, false declined, null or absent not yet answered. */
	readonly isAccepted?: boolean | null;
	/** The document's own status. */
	readonly status?: string;
}

/**
 * The invoicing capability as the order sees it.
 *
 * Provided by the platform's finance document — the core `invoice` row, its items and its estimate e-mail —
 * and injected under {@link ORDER_INVOICING}. The order package never imports the finance module: its
 * module is also hosted by the worker process, which builds no e-mail, PDF or translation providers, so a
 * dependency on the finance module would stop the worker booting. The installation joins the two in
 * `apps/api/src/plugin-composition.ts`; an installation that does not is answered
 * `ORDER_INVOICING_UNAVAILABLE` by every verb that needs a document, before anything is written.
 */
export interface IOrderInvoicingPort {
	/**
	 * Writes one document and its items.
	 *
	 * @param document The document, every figure as the order computed it.
	 * @returns The document's identity and number, and the item each key became.
	 */
	issue(document: IOrderInvoiceDocument): Promise<IOrderInvoiceIssued>;

	/**
	 * Reads one document of the caller's tenant.
	 *
	 * @param invoiceId The document.
	 * @returns What the document states, or null when the caller's tenant has no such document.
	 */
	read(invoiceId: ID): Promise<IOrderInvoiceDocumentState | null>;

	/**
	 * Voids a document the order no longer stands behind: one issued for a write that was then refused, or
	 * an estimate a newer quote superseded. The row and its number stay, because a numbered accounting
	 * document is voided rather than removed.
	 *
	 * @param invoiceId The document.
	 * @param reason Why, recorded on the document's internal note.
	 */
	voidDocument(invoiceId: ID, reason: string): Promise<void>;

	/**
	 * Sends an estimate to the buyer through the platform's estimate e-mail — the message that carries the
	 * PDF and the accept and decline links — and marks it sent when the mail transport accepted it.
	 *
	 * Never raises: a send that could not be made is an outcome the caller reports, because the quote it
	 * belongs to has already been recorded.
	 *
	 * @param invoiceId The estimate.
	 * @param recipient The address it is sent to.
	 * @returns Whether the message was handed to the mail transport, and when it was not, why.
	 */
	sendEstimate(invoiceId: ID, recipient: string): Promise<IOrderEstimateDelivery>;

	/**
	 * Records the buyer's answer to an estimate on the estimate itself: the finance document's own accept
	 * flag, and the estimate status that goes with it.
	 *
	 * @param invoiceId The estimate.
	 * @param accepted True when the buyer accepted it, false when they declined it.
	 */
	answerEstimate(invoiceId: ID, accepted: boolean): Promise<void>;
}

/** What sending an estimate to the buyer did. */
export interface IOrderEstimateDelivery {
	/** Whether the message was handed to the mail transport. */
	readonly sent: boolean;
	/** The address it was sent to, when there was one. */
	readonly recipient?: string;
	/**
	 * Why it was not sent: `NO_RECIPIENT` (the order carries no e-mail), `EMAIL_NOT_PREPARED`,
	 * `DOCUMENT_NOT_GENERATED` or `EMAIL_NOT_SENT` (the mail transport refused it — typically an
	 * installation with no mail server configured).
	 */
	readonly reason?: string;
}

/** Token the invoicing capability is injected under. */
export const ORDER_INVOICING = Symbol('ORDER_INVOICING');

/*
|--------------------------------------------------------------------------
| The approval an order is placed for
|--------------------------------------------------------------------------
*/

/** One request for a staff member's approval of an order a buyer placed. */
export interface IOrderApprovalRequest {
	/** The order the decision is about. */
	readonly orderId: ID;
	/** The organization the order belongs to, which the request is filed in. */
	readonly organizationId?: ID;
	/** What the approver's list shows: the order's number. */
	readonly name: string;
	/** The value being committed, so a threshold policy can be applied to it. */
	readonly amount: DecimalString | number;
	/** The currency of the amount. */
	readonly currency: string;
	/** The buyer's note to the approver. */
	readonly note?: string;
}

/**
 * The platform's approval machinery as the order sees it.
 *
 * Provided by the core `request_approval` row — the one place an approval lives on this platform — and
 * injected under {@link ORDER_APPROVAL}. The request is attached to the order by the polymorphic
 * `requestId` / `requestType = SALES_ORDER` pair rather than by a column on either side, which is what lets
 * the decision live in the kernel while the order stays in this package. Unbound, a request for approval is
 * answered `ORDER_APPROVAL_UNAVAILABLE` before the order moves, and a confirmation or cancellation settles
 * nothing.
 */
export interface IOrderApprovalPort {
	/**
	 * Files one approval request for an order.
	 *
	 * @param request The order, its value and the buyer's note.
	 * @returns The approval request row that was written.
	 */
	requestApproval(request: IOrderApprovalRequest): Promise<{ approvalId: ID }>;

	/**
	 * @param orderId The order.
	 * @returns The order's request still awaiting a decision, or null when it has none.
	 */
	findOpen(orderId: ID): Promise<{ approvalId: ID } | null>;

	/**
	 * Records the decision on every request of the order still awaiting one.
	 *
	 * @param orderId The order.
	 * @param approved True when the order was approved (confirmed), false when it was refused (cancelled).
	 * @returns How many requests were decided.
	 */
	settle(orderId: ID, approved: boolean): Promise<number>;
}

/** Token the approval machinery is injected under. */
export const ORDER_APPROVAL = Symbol('ORDER_APPROVAL');

/**
 * What one line's counters say, and how the status follows from them.
 *
 * The basis is the quantity the line is invoiced against: the ordered quantity under a
 * quantity-ordered policy, the fulfilled quantity under a quantity-delivered one. It is read from the
 * variant's own `billingInvoicingPolicy`, which the catalogue already declares — this revision makes
 * that declaration executable by giving it a counter to subtract from.
 */
export interface ILineInvoicePosition {
	/** The quantity the line is billed against. */
	basisQuantity: string;
	/** Quantity billed so far, as `order_line.invoicedQuantity` holds it. */
	invoicedQuantity: string;
	/** Quantity credited so far, as `order_line.creditedQuantity` holds it. */
	creditedQuantity: string;
	/** What is left to bill: `basis − invoiced`, never negative. */
	toInvoiceQuantity: string;
	/** The status the two counters imply for that basis. */
	invoiceStatus: OrderLineInvoiceStatus;
}
