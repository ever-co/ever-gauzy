import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { DecimalString, ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { IPurchaseOrder, IPurchaseOrderLine } from '../purchasing.types';
import { PurchaseOrder } from '../purchase-order/purchase-order.entity';
import { MikroOrmPurchaseOrderLineRepository } from './repository/mikro-orm-purchase-order-line.repository';

/**
 * One line of a purchase order: a sellable unit, how many of it are expected, and what it costs.
 *
 * The line carries three quantities rather than one, because "how many did we order", "how many have
 * turned up" and "how much has been billed" are three facts and the three-way match is the difference
 * between them. `receivedQuantity` and `damagedQuantity` are written only by a goods receipt, never by
 * a caller, and `billedQuantity` is a **cache the bill side re-derives** from the bill lines rather than
 * a counter anybody increments: an increment cannot be corrected when a bill is voided, and a derived
 * figure can. What is still unbilled is not stored at all — it is derived at read from the policy the
 * variant states, which is what keeps one quantity from existing twice.
 *
 * `unitId` and `conversionFactor` are what make a vendor who sells by the case of twelve while we stock
 * eaches the ordinary case rather than an arithmetic error in someone's head: the line states the unit
 * it was entered in and freezes that unit's factor, so the quantity in reference units is derivable
 * without re-reading the measurement tables.
 *
 * `vendorTermId` is **provenance, not a lookup**. It records which standing term priced the line, and
 * the line never re-reads the term afterwards — a term edited today changes future orders only, which is
 * the intent, and it is stated here so nobody "fixes" it by re-resolving open orders. `orderedPackSize`
 * is the supplier's container as it stood at order time, so a later renegotiation cannot restate the
 * arithmetic of a placed order.
 *
 * Invariant the receipt service enforces: `receivedQuantity + damagedQuantity` may not pass
 * `quantity × (1 + tolerance)`, where the tolerance is the one the line's own term negotiated, then the
 * organization's setting, then none.
 */
@ColumnIndex('IDX_purchase_order_line_vendor_term', ['vendorTermId'], {
	where: '"vendorTermId" IS NOT NULL'
})
@ColumnIndex('UQ_purchase_order_line', ['purchaseOrderId', 'variantId', 'expectedAt'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
@MultiORMEntity('purchase_order_line', { mikroOrmRepository: () => MikroOrmPurchaseOrderLineRepository })
export class PurchaseOrderLine extends TenantOrganizationBaseEntity implements IPurchaseOrderLine {
	/**
	 * The variant being bought.
	 *
	 * Declared as a plain relation id: the sellable unit belongs to the catalogue, which this domain
	 * reads through its own identifiers rather than by mapping another domain's entity. This plugin's
	 * migration creates the foreign key, restricted, because a variant that has been bought cannot be
	 * hard-deleted out of the purchasing history.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	variantId: ID;

	/**
	 * How many units were ordered, as entered in `unitId`.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	quantity: DecimalString;

	/**
	 * The unit the buyer ordered in.
	 *
	 * A plain uuid with **no foreign key here**: `unit` is created by the kernel's measurement set,
	 * which owns the target and adds the constraint once it exists. A vendor who sells by the case while
	 * we stock eaches is the ordinary case, and the line has to be able to say so.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	unitId?: ID;

	/**
	 * Snapshot of the unit's factor at entry, never re-read.
	 * `baseQuantity = quantity × conversionFactor` is what the receipt, the level and the movement
	 * consume.
	 */
	@ApiPropertyOptional({ type: () => String, default: 1 })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 24, scale: 12, default: 1 })
	conversionFactor: DecimalString;

	/**
	 * How many good units have arrived. Written by goods receipts only.
	 */
	@ApiPropertyOptional({ type: () => String, default: 0 })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	receivedQuantity: DecimalString;

	/**
	 * How many units arrived unsellable. Counted against the ordered quantity exactly like a good unit,
	 * because the supplier delivered it and the organization paid for it.
	 */
	@ApiPropertyOptional({ type: () => String, default: 0 })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	damagedQuantity: DecimalString;

	/**
	 * Sum of the quantities on the bill lines that point at this line.
	 *
	 * A **cache re-derived** from those rows, written in the same transaction as the bill and never
	 * incremented: the third of the three quantities the match compares, and the one that makes
	 * over-billing and duplicate vendor bills detectable.
	 */
	@ApiPropertyOptional({ type: () => String, default: 0 })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	billedQuantity: DecimalString;

	/**
	 * Purchase cost of one unit, in the order's currency.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	unitCost: DecimalString;

	/**
	 * Snapshot of the winning term's container at order time, when it had one — the vendor's case size,
	 * frozen on the line so a later renegotiation cannot restate the arithmetic.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, nullable: true })
	orderedPackSize?: DecimalString;

	/**
	 * Which standing term priced this line; null when it was priced by hand.
	 *
	 * Provenance only. The foreign key to `vendor_product_term` is this package's own and is created by
	 * its migration, `SET NULL`, so a term that is withdrawn and removed leaves the line readable.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	vendorTermId?: ID;

	/**
	 * Tax rate applied to the line total, as a fraction. Nullable because a supplier that states no
	 * rate is different from one that states zero.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 9, scale: 6, nullable: true })
	taxRate?: DecimalString;

	/**
	 * Discount negotiated for this line, before tax.
	 */
	@ApiPropertyOptional({ type: () => String, default: 0 })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	discountTotal: DecimalString;

	/**
	 * What the line is worth: `quantity × unitCost − discountTotal + tax`. Derived on every write.
	 */
	@ApiPropertyOptional({ type: () => String, default: 0 })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	total: DecimalString;

	/**
	 * Line-level expected date, overriding the header's when the supplier splits the delivery.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	expectedAt?: Date;

	/** Operator note for this line. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/** Open-ended extras kept beside the line. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The order this line belongs to.
	 */
	@ApiProperty({ type: () => PurchaseOrder })
	@IsNotEmpty()
	@MultiORMManyToOne(() => PurchaseOrder, (it) => it.lines, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	purchaseOrder?: IPurchaseOrder;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: PurchaseOrderLine) => it.purchaseOrder)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	purchaseOrderId?: ID;
}
