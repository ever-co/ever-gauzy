import { DeepPartial } from 'typeorm';
import { TenantOrganizationBaseEntity } from '@gauzy/core';

/**
 * A record as a caller supplies it: the entity's own columns, plus the tenancy columns the base entity
 * carries and a create or update call may state. The columns are declared by the base class, so they
 * are named here and never redeclared by a table.
 */
export type OrderWriteInput<T> = DeepPartial<T> & Partial<TenantOrganizationBaseEntity>;

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
