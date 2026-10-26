import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	ProductVariant,
	TenantOrganizationBaseEntity,
	Warehouse,
	WarehouseProduct,
	WarehouseProductVariant
} from '@gauzy/core';
import { StockMovementReferenceType, StockMovementType } from './../inventory.enums';
import { MikroOrmStockMovementRepository } from './repository/mikro-orm-stock-movement.repository';

/**
 * One row of the append-only stock ledger.
 *
 * The level tables are a cache of this table, so every row carries the quantity it produced as well
 * as the quantity it changed by. That is what lets the ledger be reconciled against the level with a
 * single sum, and what makes a gap in the chain visible rather than silent.
 *
 * A movement is never updated and never deleted: a correction is a new reversing movement. The
 * service refuses both, and the migration installs a database trigger that refuses them too, so an
 * ad-hoc statement cannot rewrite history either.
 */
@MultiORMEntity('stock_movement', { mikroOrmRepository: () => MikroOrmStockMovementRepository })
export class StockMovement extends TenantOrganizationBaseEntity {
	/**
	 * Signed change applied to the level’s on-hand quantity.
	 *
	 * Positive increases the level, negative decreases it. A reservation-only movement carries zero.
	 */
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	quantity: number;

	/**
	 * On-hand quantity of the level before the movement.
	 */
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	quantityBefore: number;

	/**
	 * On-hand quantity of the level after the movement; always `quantityBefore + quantity`.
	 */
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	quantityAfter: number;

	/**
	 * Reserved quantity of the level before the movement.
	 */
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	reservedBefore: number;

	/**
	 * Reserved quantity of the level after the movement.
	 */
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	reservedAfter: number;

	/**
	 * What caused the change.
	 */
	@ApiProperty({ type: () => String, enum: StockMovementType })
	@IsEnum(StockMovementType)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16 })
	type: StockMovementType;

	/**
	 * Kind of document that caused the change.
	 *
	 * Descriptive provenance rather than a dispatch key, so it is a string: the handler has already
	 * run by the time the row exists, and a new cause must not require an enumeration change here.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	referenceType: StockMovementReferenceType;

	/**
	 * Id of the document that caused the change. Never a foreign key: the target may belong to a
	 * package that is not installed, and the ledger must survive it.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	referenceId: ID;

	/**
	 * Machine-readable reason code, required for a manual correction.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	reason?: string;

	/**
	 * Free text from the operator.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/**
	 * Business time of the movement, which is also its ordering key within a level.
	 *
	 * Defaults to now, and may be back-dated by a receipt or a count so the ledger reflects when the
	 * goods actually moved rather than when the record was written.
	 */
	@ApiProperty({ type: () => Date })
	@IsDate()
	@ColumnIndex()
	@MultiORMColumn({ default: () => 'CURRENT_TIMESTAMP' })
	occurredAt: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Location the movement happened at. Mandatory and restricted, so a location with history cannot
	 * be hard-deleted; the supported path is the soft delete every entity already carries.
	 */
	@MultiORMManyToOne(() => Warehouse, {
		nullable: false,
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	warehouse?: Warehouse;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: StockMovement) => it.warehouse)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	warehouseId: ID;

	/**
	 * Product-level row the change was applied to, when the movement is at product granularity.
	 */
	@MultiORMManyToOne(() => WarehouseProduct, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	warehouseProduct?: WarehouseProduct;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: StockMovement) => it.warehouseProduct)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	warehouseProductId?: ID;

	/**
	 * Level row the change was applied to, when the movement is at variant granularity.
	 *
	 * Set-null rather than cascade: the ledger row must survive a level row being replaced, otherwise
	 * the location’s history would disappear with it.
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
	@RelationId((it: StockMovement) => it.warehouseProductVariant)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	warehouseProductVariantId?: ID;

	/**
	 * Variant the change applies to. Mandatory and restricted, for the same reason as the location.
	 */
	@MultiORMManyToOne(() => ProductVariant, {
		nullable: false,
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	variant?: ProductVariant;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: StockMovement) => it.variant)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	variantId: ID;

	/**
	 * Physical bin the movement happened at: the destination for an inbound type, the source for an
	 * outbound one, the level row’s home bin for a reservation-only type.
	 *
	 * Declared as a plain identifier rather than a relation because the bin table belongs to the
	 * warehouse package; the layout migration adds the constraint once that table exists.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	binId?: ID;
}
