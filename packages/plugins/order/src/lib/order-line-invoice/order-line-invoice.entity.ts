import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { CurrencyCode, ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { OrderLineInvoiceDirection } from '../order.types';
import { OrderLine } from '../order-line/order-line.entity';
import { MikroOrmOrderLineInvoiceRepository } from './repository/mikro-orm-order-line-invoice.repository';

/**
 * One line-to-invoice-item link: the pivot that makes a partial invoice expressible.
 *
 * The line's link to invoicing used to be a single column, `order_line.invoiceItemId`, and that column
 * could express exactly one thing: "this line became that item, once, for ever". A deposit taken at
 * placement and the balance billed on delivery could not both be written, and a credit note's negative
 * item had nothing linking it back to the line it credited. This table is that link, and the retained
 * column is kept — with its meaning narrowed to "the first item the line was flattened into" — so
 * nothing that reads it today breaks.
 *
 * Three properties are load-bearing:
 *
 * 1. **One row per invoice item.** `UQ_order_line_invoice_item` is what stops the pivot degenerating
 *    back into a 1:1 link: an item bills one line, and the same item cannot be counted twice.
 * 2. **The direction is the whole of the sign convention.** An `INVOICE` row adds to the line's
 *    `invoicedQuantity`; a `CREDIT` row adds to its `creditedQuantity`, which may never exceed what was
 *    invoiced. The `amount` is signed rather than the direction being inferred from it, because a
 *    zero-value credit is legal and an unsigned zero cannot say which it is.
 * 3. **The counters are written in the same transaction as this row.** A link without its counter is a
 *    line that under-reports what it has billed, and a counter without its link is a number nothing can
 *    justify — so the service takes the line's lock, writes both, and refuses the second of two
 *    concurrent writes rather than letting them interleave.
 *
 * The invoice itself is not named here, deliberately: `invoice_item` already knows its invoice, and a
 * copy would be a second source of truth for one relation — the audit would then have to check the
 * mirror, and one indexed join is cheaper than one more thing that can disagree.
 */
@ColumnIndex('UQ_order_line_invoice_item', ['invoiceItemId'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_order_line_invoice_line', ['orderLineId', 'direction'], { where: '"deletedAt" IS NULL' })
@MultiORMEntity('order_line_invoice', { mikroOrmRepository: () => MikroOrmOrderLineInvoiceRepository })
export class OrderLineInvoice extends TenantOrganizationBaseEntity {
	/**
	 * The order line this item billed or credited. A link has no meaning without its line, so the
	 * relation is mandatory and cascades: removing the line removes what described it.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@MultiORMManyToOne(() => OrderLine, (it) => it.invoiceLinks, {
		/** A link is part of the line it describes. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	orderLine?: OrderLine;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrderLineInvoice) => it.orderLine)
	@MultiORMColumn({ relationId: true })
	orderLineId: ID;

	/**
	 * The accounting item this link records — an `invoice_item`, positive for a bill and negative for a
	 * credit note. `CASCADE` because the item is the document side of the same fact: voiding the item
	 * removes the link that says the line was billed by it, and the counters are re-derived with it.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@MultiORMColumn()
	invoiceItemId: ID;

	/** Which way this link moves the line's counters. */
	@ApiProperty({ type: () => String, enum: OrderLineInvoiceDirection })
	@IsNotEmpty()
	@IsEnum(OrderLineInvoiceDirection)
	@MultiORMColumn({ type: 'simple-enum', enum: OrderLineInvoiceDirection })
	direction: OrderLineInvoiceDirection;

	/**
	 * The quantity this item actually billed, **in the order line's unit** — never the line's ordered
	 * quantity, which is the whole point: a partial invoice bills less, and the register has to be able
	 * to say how much less.
	 */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	quantity: number;

	/**
	 * Signed amount this item carried, in the order's currency; negative for a `CREDIT`.
	 */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	amount: number;

	/**
	 * Currency of the amount. Stated rather than inherited: a link is read on its own by the
	 * reconciliation, and a reconciliation that has to join to learn the currency of a number is one
	 * join away from comparing two numbers that are not the same money.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: CurrencyCode;

	/** Tenant extras: the invoice number the item was written under, an export reference. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;
}
