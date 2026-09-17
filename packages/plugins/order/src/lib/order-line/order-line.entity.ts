import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength
} from 'class-validator';
import { ID, IOrderLine } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { OrderLineInvoiceStatus, OrderLineKind } from '../order.types';
import { Order } from '../order/order.entity';
import { OrderLineInvoice } from '../order-line-invoice/order-line-invoice.entity';
import { MikroOrmOrderLineRepository } from './repository/mikro-orm-order-line.repository';

/**
 * One line of an order: what was bought, at the price it was bought at.
 *
 * Four groups of columns live here and none of them may be confused with another:
 *
 * - **Snapshots** — `title`, `sku`, `barcode`, `thumbnail`, `unitPrice`, `originalUnitPrice`,
 *   `isTaxInclusive`, `weight`. The customer bought a description at a price; renaming a product or
 *   editing a price list must not rewrite history.
 * - **Live references** — `productId`, `variantId`, `warehouseId`. Fulfilment, returns and exchanges
 *   resolve the current row, and a read falls back to the snapshot when the target is gone.
 * - **Caches of other rows** — the fulfilment, return and write-off counters, and the four registers
 *   the money side writes: `invoicedQuantity`, `creditedQuantity`, `invoiceStatus` and `refundedQuantity`
 *   / `refundedAmount`. Each has exactly one derivation rule, and each is written in the same
 *   transaction as the row that causes it.
 * - **Authored facts about this line** — `kind` (whether it is a real line at all) and `promisedAt`
 *   with the `leadTimeDays` it was computed from.
 *
 * The invoicing registers are what make a line billable **in parts**. `invoiceItemId` names the first
 * item the line was flattened into and is retained so nothing that reads it breaks; the pivot in
 * `order_line_invoice` is the line's real link to invoicing, and the two counters are its sum. A
 * deposit, a milestones invoice and a credit note therefore all have somewhere to land, where the
 * single retained column could express exactly one of them, once, for ever.
 */
@MultiORMEntity('order_line', { mikroOrmRepository: () => MikroOrmOrderLineRepository })
export class OrderLine extends TenantOrganizationBaseEntity implements IOrderLine {
	/** The order. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	orderId: ID;

	/** The product, kept for reporting and for the invoice bridge. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	productId?: ID;

	/** The sellable unit, resolved live by fulfilment, returns and exchanges. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	variantId?: ID;

	/**
	 * The seller whose offering the line was bought from, on a marketplace channel. Immutable once the
	 * order is placed: which seller is paid cannot change after the buyer agreed to the price.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	sellerId?: ID;

	/**
	 * The finance line this order line was flattened into by the order-to-invoice bridge. It lives here
	 * rather than as a new column on the core `invoice_item` table, so the core finance table is not
	 * modified and the reverse mapping stays owned by this package.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	invoiceItemId?: ID;

	/** Snapshot of the title at placement. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn()
	title: string;

	/** Snapshot of the SKU at placement. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 128 })
	sku?: string;

	/** Snapshot of the barcode, for picking and receiving. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 64 })
	barcode?: string;

	/** Snapshot of the image URL at placement. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 1024 })
	thumbnail?: string;

	/** The ordered quantity. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	quantity: number;

	/** The price at placement. Never recomputed. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	unitPrice: number;

	/** The pre-discount price, kept so the order can explain its own discount. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	originalUnitPrice: number;

	/** Whether `unitPrice` is a gross. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isTaxInclusive: boolean;

	/** A promotion may not discount this line when false. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	isDiscountable: boolean;

	/** A digital line never enters fulfilment. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	requiresShipping: boolean;

	/** The tax class. Live for a later return's computation, snapshotted in the tax lines for the applied tax. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	taxCategoryId?: ID;

	/** Snapshot of the weight, for carrier rating. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true, type: 'numeric', precision: 12, scale: 4, transformer: new ColumnNumericTransformerPipe() })
	weight?: number;

	/** Display order. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 0 })
	position: number;

	/** A note about this line. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, type: 'text' })
	note?: string;

	/** The location the line was allocated from. Fulfilment may re-allocate before shipping. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	warehouseId?: ID;

	/**
	 * The subscription the line originates from. The subscription package is installed after this one,
	 * so the column carries no constraint here.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	subscriptionId?: ID;

	/** Cache: the sum of the fulfilment lines referencing this line. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	fulfilledQuantity: number;

	/** Cache: the sum of the fulfilment lines whose fulfilment has shipped or gone further. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	shippedQuantity: number;

	/** Cache: the sum of the fulfilment lines whose fulfilment was delivered. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	deliveredQuantity: number;

	/** Cache: the sum of the non-rejected return lines. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	returnRequestedQuantity: number;

	/** Cache: the sum of the received return lines. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	returnReceivedQuantity: number;

	/** Cache: the sum of the dismissed return lines. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	returnDismissedQuantity: number;

	/** Cache: the sum of the written-off quantities. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	writtenOffQuantity: number;

	/**
	 * Quantity delivered **beyond** what was outstanding. Recorded rather than clamped: a short-picked
	 * order that ships the balance twice is a real thing, and a counter that refused to say so would
	 * make the over-delivery invisible instead of exceptional.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	overFulfilledQuantity: number;

	/**
	 * What kind of line this is.
	 *
	 * A `SECTION` or a `NOTE` is a presentation row: it carries no quantity, no price and no product, so
	 * a reader that forgets to skip one is harmless rather than wrong. Before the value set existed, a
	 * quotation that needed a heading had to be given a fake product line — which then entered the
	 * invoice, the fulfilment and the totals.
	 */
	@ApiProperty({ type: () => String, enum: OrderLineKind, default: OrderLineKind.ITEM })
	@IsOptional()
	@IsEnum(OrderLineKind)
	@MultiORMColumn({ type: 'simple-enum', enum: OrderLineKind, default: OrderLineKind.ITEM })
	kind: OrderLineKind;

	/**
	 * Cache: the quantity actually billed against this line.
	 *
	 * The sum of the `order_line_invoice` rows with `direction = INVOICE` whose invoice is not void. It
	 * is a cache and never authored, which is what makes "this line was billed in two parts" a fact the
	 * order can state rather than one reconstructed from the invoice side.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	invoicedQuantity: number;

	/** Cache: the same rows with `direction = CREDIT`. A credit may never exceed what was invoiced. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	creditedQuantity: number;

	/**
	 * Cache: how much of the line has been billed, against the basis the variant's own billing policy
	 * names. Stored rather than aggregated per row because it is the column a listing filters on, and
	 * derived rather than authored because a caller that could set it could make the order disagree
	 * with the invoices that justify it.
	 */
	@ApiProperty({ type: () => String, enum: OrderLineInvoiceStatus, default: OrderLineInvoiceStatus.NOT_INVOICED })
	@IsOptional()
	@IsEnum(OrderLineInvoiceStatus)
	@MultiORMColumn({
		type: 'simple-enum',
		enum: OrderLineInvoiceStatus,
		default: OrderLineInvoiceStatus.NOT_INVOICED,
		length: 32
	})
	invoiceStatus: OrderLineInvoiceStatus;

	/** Cache: the quantity paid back on this line, over the `refund_line` rows of succeeded refunds. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	refundedQuantity: number;

	/**
	 * Cache: the money paid back on this line, in the order's currency, stored as a positive magnitude.
	 * It carries no sibling currency column because the order it belongs to already is one.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	refundedAmount: number;

	/**
	 * The date this line was promised to the customer.
	 *
	 * Authored deliberately at placement — by staff, or from a channel's lead-time default — and
	 * **never silently rewritten**: moving a promise is an `UPDATE_ORDER_PROPERTIES` change, so the
	 * customer sees the move in the order's own history rather than finding a different date.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	promisedAt?: Date;

	/**
	 * The lead time the promise was computed from, so the promise stays explainable after the product's
	 * own lead time changes.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ nullable: true, type: 'int' })
	leadTimeDays?: number;

	/** Open-ended payload: age limits, promotion codes, tax-rate codes and substitution notes. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** The order. */
	@MultiORMManyToOne(() => Order, (it) => it.lines, { onDelete: 'CASCADE' })
	@JoinColumn()
	order?: Order;

	/**
	 * Every invoice item and credit-note item this line was billed through.
	 *
	 * This is the line's real link to invoicing — one line, many items, across many invoices — and the
	 * two counters above are its sum. The retained `invoiceItemId` names the first of them.
	 */
	@MultiORMOneToMany(() => OrderLineInvoice, (it) => it.orderLine, { onDelete: 'CASCADE' })
	invoiceLinks?: OrderLineInvoice[];
}
