import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrencyCode, DecimalString, ID, IOrganizationVendor, IWarehouse } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	OrganizationVendor,
	TenantOrganizationBaseEntity,
	Warehouse
} from '@gauzy/core';
import { IGoodsReceipt, IPurchaseOrder, IPurchaseOrderLine, PurchaseOrderStatus } from '../purchasing.types';
import { PurchaseOrderLine } from '../purchase-order-line/purchase-order-line.entity';
import { GoodsReceipt } from '../goods-receipt/goods-receipt.entity';
import { MikroOrmPurchaseOrderRepository } from './repository/mikro-orm-purchase-order.repository';

/**
 * A document ordering goods from a supplier.
 *
 * The header carries the lifecycle and the money; the lines carry what is actually expected. Three
 * things about it are load-bearing:
 *
 * - the **status** decides whether the ordered remainder counts as incoming at the receiving location,
 *   so `SENT` and everything after it is what a replenishment report sees and `CANCELED` or `CLOSED`
 *   is what removes it;
 * - the **totals are derived**, re-computed from the lines on every write rather than accumulated, so
 *   a corrected line can never leave a stale total behind;
 * - **approval is a recorded fact, not a status**. The order stays `DRAFT` while it is being approved
 *   and `approvedAt` / `approvedByUserId` / `approvalId` are what a reviewer reads, because a
 *   rejected approval has to leave the order exactly where it was.
 *
 * Three of the columns belong to the agreement with the supplier rather than to the document.
 * `vendorReference` is the **supplier's own** number, which their acknowledgement and their bill quote;
 * without it the three-way match is guesswork by amount and date. `paymentTermId` and
 * `paymentTermsDaysSnapshot` record the settlement schedule as it stood when the order was raised —
 * the schedule the supplier's own terms resolved to — and `dueDate` is computed from them once and
 * snapshotted, so an ageing or dunning report reads this order rather than a supplier row that may
 * since have been renegotiated. `buyerUserId` is who owns the order, which is the routing key for
 * every approval and follow-up.
 *
 * `version` is the optimistic-lock counter: every transition takes the value it read and bumps it, so
 * two operators acting on one order cannot both win.
 */
@ColumnIndex('IDX_purchase_order_vendor_ref', ['vendorId', 'vendorReference'], {
	where: '"vendorReference" IS NOT NULL AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_purchase_order_due', ['organizationId', 'dueDate'], {
	where: '"dueDate" IS NOT NULL AND "deletedAt" IS NULL'
})
@MultiORMEntity('purchase_order', { mikroOrmRepository: () => MikroOrmPurchaseOrderRepository })
export class PurchaseOrder extends TenantOrganizationBaseEntity implements IPurchaseOrder {
	/**
	 * Human-readable order number, allocated from the `PO` series so a supplier can quote it.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	number: string;

	/**
	 * The supplier the goods are ordered from.
	 *
	 * The supplier master is the platform's existing vendor entity, which this plugin extends with the
	 * purchasing columns it needs rather than duplicating into a second party table. Restricted, so a
	 * supplier with purchasing history cannot be hard-deleted out from under it.
	 */
	@ApiProperty({ type: () => OrganizationVendor })
	@IsNotEmpty()
	@MultiORMManyToOne(() => OrganizationVendor, {
		/** Database cascade action on delete. */
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	vendor?: IOrganizationVendor;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: PurchaseOrder) => it.vendor)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	vendorId: ID;

	/**
	 * The location the goods are expected at.
	 *
	 * Receiving into a different location is a transfer between locations, not a receipt against this
	 * order, which is why the receipt service refuses a receipt whose location differs.
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
	@RelationId((it: PurchaseOrder) => it.warehouse)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	warehouseId: ID;

	/**
	 * The **supplier's own** order number.
	 *
	 * Deliberately not matched against the supplier's code on the vendor row: that is the supplier's
	 * identity, this is the document's. Their acknowledgement and their bill quote this reference, and
	 * without it the three-way match has only an amount and a date to go on.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	vendorReference?: string;

	/**
	 * Who owns this order — the routing key for every approval and follow-up.
	 *
	 * Defaulted to the caller when the order is raised, and kept as a plain id: the user directory is
	 * the platform's, and the constraint on it is added by this package's migration.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	buyerUserId?: ID;

	/**
	 * Where the order is in its lifecycle.
	 */
	@ApiProperty({ type: () => String, enum: PurchaseOrderStatus })
	@IsEnum(PurchaseOrderStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 32, default: PurchaseOrderStatus.DRAFT })
	status: PurchaseOrderStatus;

	/**
	 * Currency every amount on this order is expressed in. A line never carries a currency of its own:
	 * one order is one commercial commitment in one currency.
	 */
	@ApiProperty({ type: () => String, maxLength: 3 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: CurrencyCode;

	/*
	|--------------------------------------------------------------------------
	| Money — exact decimals, never floats
	|--------------------------------------------------------------------------
	*/

	/** Sum of the line totals before the header-level adjustments. */
	@ApiProperty({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	subtotal: DecimalString;

	/** Discount agreed on the whole order, on top of the per-line discounts. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	discountTotal: DecimalString;

	/** Tax not already carried by the lines, e.g. a duty charged on the shipment as a whole. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	taxTotal: DecimalString;

	/** Freight and handling charged by the supplier. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	shippingTotal: DecimalString;

	/**
	 * What the order is worth: `subtotal − discountTotal + taxTotal + shippingTotal`. Derived on every
	 * write, never set by a caller.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	grandTotal: DecimalString;

	/*
	|--------------------------------------------------------------------------
	| The settlement schedule, snapshotted
	|--------------------------------------------------------------------------
	*/

	/**
	 * The settlement schedule the order runs on.
	 *
	 * A plain uuid with **no foreign key here**: `payment_term` is created by the kernel's settlement
	 * set, which owns the target and adds the constraint once it exists. The order keeps the id from the
	 * moment it is raised, so an installation that installs this package before the kernel's term tables
	 * still records what the order was raised against.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	paymentTermId?: ID;

	/**
	 * The simple settlement form, in days, as it stood at order time.
	 *
	 * Snapshotted rather than read back from the supplier, so a later edit to a supplier's terms cannot
	 * silently move the due date of an order that has already been placed.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', nullable: true })
	paymentTermsDaysSnapshot?: number;

	/**
	 * When the order falls due, computed once from the resolved settlement schedule and snapshotted.
	 * An ageing or dunning report reads this column and never the live supplier row.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	dueDate?: Date;

	/*
	|--------------------------------------------------------------------------
	| Lifecycle timestamps
	|--------------------------------------------------------------------------
	*/

	/** When the supplier said the goods would arrive. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	expectedAt?: Date;

	/** When the order was sent, which is the instant its quantities start counting as incoming. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	orderedAt?: Date;

	/** When the order was sent; kept beside `orderedAt` because the two are read by different screens. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	sentAt?: Date;

	/** When the supplier confirmed the order. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	acknowledgedAt?: Date;

	/** When the order was approved internally. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	approvedAt?: Date;

	/** Who approved it. Kept as a plain id: the user directory is the platform's. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	approvedByUserId?: ID;

	/** The platform approval request this order is waiting on, when the tenant requires one. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	approvalId?: ID;

	/**
	 * When every line was received in full. Non-null exactly when the status is `RECEIVED` or
	 * `CLOSED` — the two states that mean nothing further is expected.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	receivedAt?: Date;

	/** When the order was abandoned before anything arrived. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	canceledAt?: Date;

	/** When the order was finished short of the ordered quantity. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	closedAt?: Date;

	/**
	 * Optimistic-lock counter. Every transition takes the counter it read and bumps it.
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
	 * Open-ended extras: the supplier's own reference, an import's provenance, the over-receipt
	 * tolerance this order was raised with.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * What is expected. A draft order's lines are rewritten as a set; once anything has been received
	 * the set is frozen, because the received counters are the ledger's record of what arrived.
	 */
	@ApiPropertyOptional({ type: () => PurchaseOrderLine, isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => PurchaseOrderLine, (it) => it.purchaseOrder, {
		cascade: true
	})
	lines?: IPurchaseOrderLine[];

	/**
	 * What actually arrived against this order, once per delivery.
	 */
	@ApiPropertyOptional({ type: () => GoodsReceipt, isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => GoodsReceipt, (it) => it.purchaseOrder)
	receipts?: IGoodsReceipt[];
}
