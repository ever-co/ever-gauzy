import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	ProductVariant,
	TenantOrganizationBaseEntity,
	User,
	Warehouse
} from '@gauzy/core';
import { StockAdjustmentStatus, StockAdjustmentType } from './../inventory.enums';
import { MikroOrmStockAdjustmentRepository } from './repository/mikro-orm-stock-adjustment.repository';

/**
 * The instruction row behind a manual quantity change.
 *
 * Every movement must name the document that caused it, and a manual correction has no natural
 * document behind it. Naming this row is what keeps the rule enforceable: an operator’s correction is
 * attributable to a person, a reason and a time, and the ledger row it produced is reachable from it.
 *
 * An applied instruction is immutable and has exactly one movement. A mistake is corrected by a new
 * instruction, never by editing an applied one.
 */
@MultiORMEntity('stock_adjustment', { mikroOrmRepository: () => MikroOrmStockAdjustmentRepository })
export class StockAdjustment extends TenantOrganizationBaseEntity {
	/**
	 * Instruction number, allocated from the platform’s numbering series.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(32)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 32 })
	number: string;

	/**
	 * How the stated quantity is interpreted.
	 */
	@ApiProperty({ type: () => String, enum: StockAdjustmentType })
	@IsEnum(StockAdjustmentType)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16 })
	type: StockAdjustmentType;

	/**
	 * The stated quantity. For a set it is the observed target, and the service derives the delta.
	 */
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	quantity: number;

	/**
	 * Governed reason code, validated against the platform’s reason catalogue when present.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	reasonCode?: string;

	/**
	 * Free-text supplement to the reason code.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
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
	 * Lifecycle state of the instruction.
	 */
	@ApiProperty({ type: () => String, enum: StockAdjustmentStatus })
	@IsEnum(StockAdjustmentStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: StockAdjustmentStatus.DRAFT })
	status: StockAdjustmentStatus;

	/**
	 * When the instruction was applied.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	appliedAt?: Date;

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
	 * Location being corrected.
	 */
	@MultiORMManyToOne(() => Warehouse, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	warehouse?: Warehouse;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: StockAdjustment) => it.warehouse)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	warehouseId: ID;

	/**
	 * Variant being corrected.
	 */
	@MultiORMManyToOne(() => ProductVariant, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	variant?: ProductVariant;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: StockAdjustment) => it.variant)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	variantId: ID;

	/**
	 * Level row the correction was applied to; resolved on apply when the instruction did not name it.
	 */
	@MultiORMColumn({ nullable: true })
	warehouseProductVariantId?: ID;

	/**
	 * Operator who applied the instruction.
	 */
	@MultiORMManyToOne(() => User, {
		nullable: true,
		onDelete: 'SET NULL',

		/** Column the relation is stored in, named for MikroORM as `@JoinColumn` names it for TypeORM. */
		joinColumn: 'appliedByUserId'
	})
	@JoinColumn({ name: 'appliedByUserId' })
	appliedBy?: User;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: StockAdjustment) => it.appliedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	appliedByUserId?: ID;

	/**
	 * Ledger row the instruction produced.
	 *
	 * Declared as a plain identifier: the movement service owns that table, and a relation here would
	 * invite a caller to walk from an instruction to the ledger and back into a second write path.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	movementId?: ID;
}
