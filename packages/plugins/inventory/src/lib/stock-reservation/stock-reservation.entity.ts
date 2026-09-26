import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	ProductVariant,
	TenantOrganizationBaseEntity,
	Warehouse,
	WarehouseProductVariant
} from '@gauzy/core';
import { StockReservationReferenceType, StockReservationStatus } from './../inventory.enums';
import { MikroOrmStockReservationRepository } from './repository/mikro-orm-stock-reservation.repository';

/**
 * Stock held aside for a cart, an order or a post-purchase replacement.
 *
 * The row is the intent; the ledger is the effect. Both must agree, and the reconciliation job
 * re-derives the level row’s reserved quantity from this table when they do not, because this is
 * the record of what the business believes it has promised.
 *
 * The mutable surface is deliberately narrow: quantity, location and variant are written once, and
 * the only permitted mutations are the state transition, the expiry, and the re-pointing performed
 * when a cart’s holds become an order’s holds.
 */
@MultiORMEntity('stock_reservation', { mikroOrmRepository: () => MikroOrmStockReservationRepository })
export class StockReservation extends TenantOrganizationBaseEntity {
	/**
	 * Held quantity. Always positive: releasing closes the row rather than writing a negative quantity.
	 */
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	quantity: number;

	/**
	 * Lifecycle state; `ACTIVE` is the only non-terminal value.
	 */
	@ApiProperty({ type: () => String, enum: StockReservationStatus })
	@IsEnum(StockReservationStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: StockReservationStatus.ACTIVE })
	status: StockReservationStatus;

	/**
	 * Kind of document the hold belongs to.
	 */
	@ApiProperty({ type: () => String, enum: StockReservationReferenceType })
	@IsEnum(StockReservationReferenceType)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16 })
	referenceType: StockReservationReferenceType;

	/**
	 * Id of the owning document. Never a foreign key: the cart, order, return and subscription tables
	 * belong to packages that may not be installed.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	referenceId: ID;

	/**
	 * Id of the owning line, when the hold belongs to one line rather than to a whole document.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	lineId?: ID;

	/**
	 * When the hold lapses. A cart hold always sets it; an order hold may leave it unset.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	expiresAt?: Date;

	/**
	 * Set when the hold is released or expires.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	releasedAt?: Date;

	/**
	 * Set when the hold is consumed, that is when the stock actually left.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	consumedAt?: Date;

	/**
	 * True when the hold was taken against stock that does not exist yet because the level allows a
	 * backorder. Reported separately in availability answers and never used to block a sale.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	isBackorder: boolean;

	/**
	 * Expected availability date of a backordered hold.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	expectedAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Variant the hold applies to.
	 */
	@MultiORMManyToOne(() => ProductVariant, {
		nullable: false,
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	variant?: ProductVariant;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: StockReservation) => it.variant)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	variantId: ID;

	/**
	 * Location the hold applies to. Allocation decides it; nothing else changes it afterwards.
	 */
	@MultiORMManyToOne(() => Warehouse, {
		nullable: false,
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	warehouse?: Warehouse;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: StockReservation) => it.warehouse)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	warehouseId: ID;

	/**
	 * Level row the hold is counted against.
	 */
	@MultiORMManyToOne(() => WarehouseProductVariant, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	warehouseProductVariant?: WarehouseProductVariant;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: StockReservation) => it.warehouseProductVariant)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	warehouseProductVariantId?: ID;
}
