import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID, IWarehouse } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity,
	Warehouse
} from '@gauzy/core';
import { GoodsReceiptStatus, IGoodsReceipt, IGoodsReceiptLine, IPurchaseOrder } from '../purchasing.types';
import { GoodsReceiptLine } from '../goods-receipt-line/goods-receipt-line.entity';
import { PurchaseOrder } from '../purchase-order/purchase-order.entity';
import { MikroOrmGoodsReceiptRepository } from './repository/mikro-orm-goods-receipt.repository';

/**
 * One physical delivery.
 *
 * Partial deliveries are several receipts rather than one editable document, which is what makes the
 * order's outstanding quantity answerable: it is the ordered quantity minus the sum of the receipts.
 *
 * **The delivery is anchored to an order, and the anchor is optional.** A consolidated delivery
 * covering several orders, and goods arriving with no order at all, are both ordinary; what makes
 * either readable is that the receipt line points at the order line it came against, which is the
 * relation the match and the receipt itself run on. A receipt that does name an order is checked
 * against it: every line has to belong to it.
 *
 * A receipt is written once and never edited. Correcting one means reversing it, which writes the
 * compensating stock movements the ledger needs and leaves both documents readable — an edited
 * receipt would leave movements in the ledger that no document explains.
 *
 * The location on a receipt must equal the location of every order its lines belong to. Receiving into
 * a different building is a transfer, not a receipt, and allowing it here would silently move stock
 * between locations.
 */
@MultiORMEntity('goods_receipt', { mikroOrmRepository: () => MikroOrmGoodsReceiptRepository })
export class GoodsReceipt extends TenantOrganizationBaseEntity implements IGoodsReceipt {
	/**
	 * Human-readable receipt number, allocated from the `RECEIPT` series.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	number: string;

	/**
	 * Where the receipt is in its lifecycle.
	 */
	@ApiProperty({ type: () => String, enum: GoodsReceiptStatus })
	@IsEnum(GoodsReceiptStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: GoodsReceiptStatus.POSTED })
	status: GoodsReceiptStatus;

	/**
	 * When the goods physically arrived. Stated rather than assumed, because a receipt is often
	 * recorded after the fact and the ledger's ordering depends on when it happened.
	 */
	@ApiProperty({ type: () => Date })
	@IsNotEmpty()
	@IsDate()
	@MultiORMColumn()
	receivedAt: Date;

	/** Who recorded the delivery. Kept as a plain id: the user directory is the platform's. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	receivedByUserId?: ID;

	/** When the receipt was reversed. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	canceledAt?: Date;

	/**
	 * Optimistic-lock counter. Reversing a receipt takes the counter it read and bumps it.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 1 })
	version: number;

	/** Operator note. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/**
	 * Open-ended extras: the supplier's delivery note reference, the packing list, the reason a receipt
	 * was reversed.
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
	 * The order this delivery is anchored to, when it is anchored to one.
	 *
	 * **Optional**, because a consolidated delivery covering several orders is routine and goods
	 * sometimes arrive with no order at all. The authoritative relation is the receipt line's own order
	 * line, so the header column is a convenience anchor rather than the relationship: a consolidated
	 * delivery no longer has to be split into receipts that never happened, and a receipt with no order
	 * writes its movements without touching any order line.
	 *
	 * The service checks what the column cannot: when it is set, every line of the receipt has to belong
	 * to that order.
	 */
	@ApiPropertyOptional({ type: () => PurchaseOrder })
	@IsOptional()
	@MultiORMManyToOne(() => PurchaseOrder, (it) => it.receipts, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	purchaseOrder?: IPurchaseOrder;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: GoodsReceipt) => it.purchaseOrder)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true, nullable: true })
	purchaseOrderId?: ID;

	/**
	 * The location the goods arrived at. Restricted, so a location with receiving history cannot be
	 * hard-deleted.
	 */
	@ApiProperty({ type: () => Warehouse })
	@IsNotEmpty()
	@MultiORMManyToOne(() => Warehouse, {
		/** Database cascade action on delete. */
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	warehouse?: IWarehouse;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: GoodsReceipt) => it.warehouse)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	warehouseId: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * What arrived, line by line.
	 */
	@ApiPropertyOptional({ type: () => GoodsReceiptLine, isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => GoodsReceiptLine, (it) => it.receipt, {
		cascade: true
	})
	lines?: IGoodsReceiptLine[];
}
