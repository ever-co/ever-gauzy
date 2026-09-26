import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DecimalString, ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { IGoodsReceipt, IGoodsReceiptLine, IPurchaseOrderLine } from '../purchasing.types';
import { GoodsReceipt } from '../goods-receipt/goods-receipt.entity';
import { PurchaseOrderLine } from '../purchase-order-line/purchase-order-line.entity';
import { MikroOrmGoodsReceiptLineRepository } from './repository/mikro-orm-goods-receipt-line.repository';

/**
 * One line of a goods receipt: what arrived, how much of it is sellable, and what it cost.
 *
 * Three quantities are kept apart because the stock ledger is told about each of them differently. A
 * good unit increments the level through a `RECEIPT` movement. A damaged unit writes a `DAMAGE`
 * movement that leaves the level alone, so a unit that arrived broken is recorded, is never sellable,
 * and can never be sold by accident. Both count against the ordered quantity, because the supplier
 * delivered both and the organization will be invoiced for both.
 *
 * `stockMovementId` is the link that makes a receipt traceable to the ledger in both directions and
 * is what makes a replayed receipt detectable: it is written once, in the same transaction as the
 * receipt, and never afterwards.
 *
 * Invariant the service enforces: `quantity + damagedQuantity > 0`.
 */
@MultiORMEntity('goods_receipt_line', { mikroOrmRepository: () => MikroOrmGoodsReceiptLineRepository })
export class GoodsReceiptLine extends TenantOrganizationBaseEntity implements IGoodsReceiptLine {
	/**
	 * The order line this delivery is against. Restricted to the order's own line, so a receipt can
	 * never be received against a different order than the one the header names.
	 */
	@ApiProperty({ type: () => PurchaseOrderLine })
	@IsNotEmpty()
	@MultiORMManyToOne(() => PurchaseOrderLine, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	purchaseOrderLine?: IPurchaseOrderLine;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: GoodsReceiptLine) => it.purchaseOrderLine)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	purchaseOrderLineId: ID;

	/**
	 * The variant that arrived, repeated from the order line so the movement can be written without a
	 * second read and so the line stays readable after the order line is archived.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	variantId: ID;

	/**
	 * Good units that arrived and go into sellable stock.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	quantity: DecimalString;

	/**
	 * Units that arrived unsellable. Recorded, never sellable.
	 */
	@ApiPropertyOptional({ type: () => String, default: 0 })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	damagedQuantity: DecimalString;

	/**
	 * Actual landed cost per unit, which may differ from the ordered cost — a supplier re-prices, a
	 * freight surcharge lands, a discount is applied at delivery. This is the value the cost update
	 * reads, not the order line's.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	unitCost: DecimalString;

	/**
	 * Lot or batch the units belong to, carried onto the movement so the ledger stays batch-accurate.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	batchNumber?: string;

	/**
	 * Shelf life of the received units.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	expiresAt?: Date;

	/**
	 * The bin the units are to be placed into once they are inside the building.
	 *
	 * The bin belongs to the warehouse capability, so this is a plain id with no foreign key here: the
	 * table is created by a later migration set, and a constraint is added by the set that owns its
	 * target. Put-away itself goes through the inventory capability, like every other stock write of
	 * this domain.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	warehouseBinId?: ID;

	/**
	 * The `RECEIPT` movement this line produced — the good units' movement, which is the one a
	 * put-away walks. Set once, immediately, and never rewritten.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	stockMovementId?: ID;

	/** Operator note for this line. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/**
	 * Open-ended extras: the disposition of the damaged units, the currency-mismatch marker the cost
	 * update sets, the reverse of a reversal.
	 */
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
	 * The receipt this line belongs to.
	 */
	@ApiProperty({ type: () => GoodsReceipt })
	@IsNotEmpty()
	@MultiORMManyToOne(() => GoodsReceipt, (it) => it.lines, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	receipt?: IGoodsReceipt;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: GoodsReceiptLine) => it.receipt)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	receiptId?: ID;
}
