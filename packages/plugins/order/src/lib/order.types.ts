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
