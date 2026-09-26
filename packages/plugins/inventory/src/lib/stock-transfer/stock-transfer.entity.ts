import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity,
	Warehouse
} from '@gauzy/core';
import { StockTransferStatus } from './../inventory.enums';
import { MikroOrmStockTransferRepository } from './repository/mikro-orm-stock-transfer.repository';

/**
 * A movement of stock between two locations.
 *
 * The transfer is the document; the stock effect is two ledger movements, an outbound one at the
 * source when it is dispatched and an inbound one at the destination when it is received. The row
 * itself never stores a quantity: it records which state the document reached and when, and the
 * lines record what was asked for, what left and what arrived.
 */
@MultiORMEntity('stock_transfer', { mikroOrmRepository: () => MikroOrmStockTransferRepository })
export class StockTransfer extends TenantOrganizationBaseEntity {
	/**
	 * Document number, allocated from the platform’s numbering series and unique per organization.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	number: string;

	/**
	 * Lifecycle state of the transfer.
	 */
	@ApiProperty({ type: () => String, enum: StockTransferStatus })
	@IsEnum(StockTransferStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 32, default: StockTransferStatus.DRAFT })
	status: StockTransferStatus;

	/**
	 * When the transfer was dispatched.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	shippedAt?: Date;

	/**
	 * When every line was received.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	receivedAt?: Date;

	/**
	 * Free text from the operator.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/**
	 * Optimistic-lock counter. Every transition takes the counter it read and bumps it, so two
	 * operators acting on the same transfer cannot both win.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 1 })
	version: number;

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
	 * Location the stock leaves. Restricted, so a location with history cannot be hard-deleted.
	 */
	@MultiORMManyToOne(() => Warehouse, {
		nullable: false,
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	fromWarehouse?: Warehouse;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: StockTransfer) => it.fromWarehouse)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	fromWarehouseId: ID;

	/**
	 * Location the stock arrives at.
	 */
	@MultiORMManyToOne(() => Warehouse, {
		nullable: false,
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	toWarehouse?: Warehouse;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: StockTransfer) => it.toWarehouse)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	toWarehouseId: ID;
}
