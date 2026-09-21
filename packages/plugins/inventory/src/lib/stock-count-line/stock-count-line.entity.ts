import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	ProductVariant,
	TenantOrganizationBaseEntity,
	User,
	WarehouseProductVariant
} from '@gauzy/core';
import { StockCountLineStatus } from './../inventory.enums';
import { StockCount } from './../stock-count/stock-count.entity';
import { MikroOrmStockCountLineRepository } from './repository/mikro-orm-stock-count-line.repository';

/**
 * One variant’s reading inside a count session.
 *
 * The expectation is a snapshot and the readings are what the floor reported, so the variance is a
 * fact about the session rather than a recomputation. `variance` is derived by the service and is
 * therefore never accepted from a caller.
 */
@MultiORMEntity('stock_count_line', { mikroOrmRepository: () => MikroOrmStockCountLineRepository })
export class StockCountLine extends TenantOrganizationBaseEntity {
	/**
	 * Expectation snapshotted when the line was generated.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	expectedQuantity: number;

	/**
	 * First reading. Null until the line is counted.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, nullable: true })
	countedQuantity?: number;

	/**
	 * Second reading, when the line was recounted. The recount is the value that closes the line.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, nullable: true })
	recountedQuantity?: number;

	/**
	 * Difference between the reading that closes the line and the expectation.
	 *
	 * Derived by the service and exposed read-only: a client that could post a variance would be able
	 * to make the report say anything.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, nullable: true })
	variance?: number;

	/**
	 * Outcome recorded against the line.
	 */
	@ApiProperty({ type: () => String, enum: StockCountLineStatus })
	@IsEnum(StockCountLineStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: StockCountLineStatus.PENDING })
	status: StockCountLineStatus;

	/**
	 * When the line was counted.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	countedAt?: Date;

	/**
	 * Free text from the counter.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/**
	 * The address as printed on the sheet; never recomputed, so a re-parented bin cannot rewrite what
	 * was walked.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	binPathSnapshot?: string;

	/**
	 * Operator who counted the line.
	 */
	@MultiORMManyToOne(() => User, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn({ name: 'countedByUserId' })
	countedBy?: User;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: StockCountLine) => it.countedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	countedByUserId?: ID;

	/**
	 * Ledger row written when the variance was non-zero.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	movementId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Session the line belongs to. Cascaded, because a line has no meaning without its session.
	 */
	@MultiORMManyToOne(() => StockCount, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	stockCount?: StockCount;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: StockCountLine) => it.stockCount)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	stockCountId: ID;

	/**
	 * Variant being counted.
	 */
	@MultiORMManyToOne(() => ProductVariant, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	variant?: ProductVariant;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: StockCountLine) => it.variant)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	variantId: ID;

	/**
	 * Level row the line snapshots.
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
	@RelationId((it: StockCountLine) => it.warehouseProductVariant)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	warehouseProductVariantId?: ID;

	/**
	 * Bin counted, when the line is bin-scoped. Declared as a plain identifier: the bin table belongs
	 * to the warehouse package, whose layout migration adds the constraint.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	binId?: ID;
}
