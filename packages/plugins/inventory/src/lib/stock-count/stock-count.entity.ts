import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity,
	User,
	Warehouse
} from '@gauzy/core';
import { StockCountMode, StockCountStatus } from './../inventory.enums';
import { MikroOrmStockCountRepository } from './repository/mikro-orm-stock-count.repository';

/**
 * A physical count session.
 *
 * Variants are counted inside a session rather than through a series of separate corrections, which
 * is what keeps one variance report per location and per count. Opening a session snapshots the
 * expected quantity of every line, so the variance it reports is the difference between what the
 * record believed and what the floor found — not a number recomputed after the fact.
 */
@MultiORMEntity('stock_count', { mikroOrmRepository: () => MikroOrmStockCountRepository })
export class StockCount extends TenantOrganizationBaseEntity {
	/**
	 * Session number, allocated from the platform’s numbering series.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(32)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 32 })
	number: string;

	/**
	 * Lifecycle state of the session.
	 */
	@ApiProperty({ type: () => String, enum: StockCountStatus })
	@IsEnum(StockCountStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: StockCountStatus.DRAFT })
	status: StockCountStatus;

	/**
	 * How the scope was generated.
	 */
	@ApiProperty({ type: () => String, enum: StockCountMode })
	@IsEnum(StockCountMode)
	@MultiORMColumn({ type: 'varchar', length: 16, default: StockCountMode.FULL })
	mode: StockCountMode;

	/**
	 * When true the expected quantity is withheld from a caller that lacks the stock view permission,
	 * so a counter cannot simply copy the number the system already believes.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	blindCount: boolean;

	/**
	 * When true, quantity-changing movements inside the session’s scope are refused while it is open,
	 * so the sheet cannot be invalidated by the floor moving goods underneath it.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: true })
	freezeMovements: boolean;

	/**
	 * The filter used to generate the lines.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	scope?: Record<string, any>;

	/**
	 * The extended scope criteria: explicit variant ids, categories, bin types, ABC classes.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	scopeCriteria?: Record<string, any>;

	/**
	 * How many lines have been counted.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 0 })
	countedLineCount: number;

	/**
	 * Sum of the absolute variances of the session, in units.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	varianceUnits: number;

	/**
	 * Sum of the absolute variances valued at unit cost.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	varianceValue: number;

	/**
	 * When the session was opened.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	startedAt?: Date;

	/**
	 * When the session was closed.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	closedAt?: Date;

	/**
	 * Free text from the operator.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/**
	 * Tenant extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, any>;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Location being counted.
	 */
	@MultiORMManyToOne(() => Warehouse, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	warehouse?: Warehouse;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: StockCount) => it.warehouse)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	warehouseId: ID;

	/**
	 * Operator who opened the session.
	 */
	@MultiORMManyToOne(() => User, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	startedBy?: User;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: StockCount) => it.startedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	startedByUserId?: ID;

	/**
	 * Operator who closed the session.
	 */
	@MultiORMManyToOne(() => User, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	closedBy?: User;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: StockCount) => it.closedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	closedByUserId?: ID;

	/**
	 * Zone being counted, when the session is scoped to one.
	 *
	 * Declared as a plain identifier: the zone table belongs to the warehouse package, whose layout
	 * migration adds the constraints once those tables exist.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	zoneId?: ID;

	/**
	 * Bin being counted, when the session is scoped to one. Mutually exclusive with the zone.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	binId?: ID;

	/**
	 * Links a recount to the session it recounts.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	recountOfId?: ID;
}
