import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	ProductVariant,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { StockTransfer } from './../stock-transfer/stock-transfer.entity';
import { MikroOrmStockTransferLineRepository } from './repository/mikro-orm-stock-transfer-line.repository';

/**
 * One variant’s quantities on a transfer.
 *
 * The three quantities are separate columns rather than one derived number because they answer three
 * different questions: what was asked for, what actually left, and what actually arrived. A shortfall
 * between them is a fact about the shipment, not an error to be reconciled away.
 */
@MultiORMEntity('stock_transfer_line', { mikroOrmRepository: () => MikroOrmStockTransferLineRepository })
export class StockTransferLine extends TenantOrganizationBaseEntity {
	/**
	 * Quantity asked for.
	 */
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	requestedQuantity: number;

	/**
	 * Quantity dispatched from the source location.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	shippedQuantity: number;

	/**
	 * Quantity that arrived at the destination.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	receivedQuantity: number;

	/**
	 * Quantity that arrived unsellable; written off by a damage movement.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	damagedQuantity: number;

	/**
	 * Cost carried across the transfer for valuation. Never computed here: it is what the source
	 * location says the units cost.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, nullable: true })
	unitCost?: number;

	/**
	 * Free text from the operator.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Transfer the line belongs to. Cascaded, because a line has no meaning without its document.
	 */
	@MultiORMManyToOne(() => StockTransfer, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	transfer?: StockTransfer;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: StockTransferLine) => it.transfer)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	transferId: ID;

	/**
	 * Variant being moved. Restricted, so a variant with transfer history cannot be hard-deleted.
	 */
	@MultiORMManyToOne(() => ProductVariant, {
		nullable: false,
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	variant?: ProductVariant;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: StockTransferLine) => it.variant)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	variantId: ID;
}
