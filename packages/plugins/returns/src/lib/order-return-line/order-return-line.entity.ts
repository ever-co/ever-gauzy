import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { DecimalString, ID, IWarehouse } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity,
	Warehouse
} from '@gauzy/core';
import { IOrderReturn, IOrderReturnLine, IOrderReturnReason } from '../returns.types';
import { OrderReturnReason } from '../order-return-reason/order-return-reason.entity';
import { OrderReturn } from '../order-return/order-return.entity';
import { MikroOrmOrderReturnLineRepository } from './repository/mikro-orm-order-return-line.repository';

/**
 * One line of a return.
 *
 * The line carries three quantities rather than one, because "how much did we ask for", "how much
 * physically arrived" and "how much of it is unsellable" are three different facts and a return is
 * settled on the last two. The restock decision is per line: a sealed item goes back on the shelf
 * while the same item returned opened does not, and no reason code can decide that in advance.
 *
 * Invariant the service enforces: `receivedQuantity + damagedQuantity <= quantity`.
 */
@MultiORMEntity('order_return_line', { mikroOrmRepository: () => MikroOrmOrderReturnLineRepository })
export class OrderReturnLine extends TenantOrganizationBaseEntity implements IOrderReturnLine {
	/**
	 * The order line being returned.
	 *
	 * Declared as a plain relation id: the order line belongs to the order domain, which this plugin
	 * reads through the platform service layer rather than by mapping another domain's entity. This
	 * plugin's migration creates the foreign key, and the service checks the requested quantity
	 * against the fulfilled quantity the order line reports.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	orderLineId?: ID;

	/**
	 * Requested return quantity.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	quantity: DecimalString;

	/**
	 * Quantity that physically arrived and was accepted.
	 */
	@ApiPropertyOptional({ type: () => String, default: 0 })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	receivedQuantity: DecimalString;

	/**
	 * Quantity that arrived unsellable. It is written off rather than restocked, and it counts against
	 * the requested quantity exactly like a good unit does.
	 */
	@ApiPropertyOptional({ type: () => String, default: 0 })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	damagedQuantity: DecimalString;

	/**
	 * Whether the received goods go back into sellable stock. `false` records the goods as removed
	 * from stock and never increments a level.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: true })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	restock: boolean;

	/**
	 * Operator note for this line, e.g. the inspection outcome.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/**
	 * Open-ended extras kept beside the line.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The return this line belongs to.
	 */
	@ApiProperty({ type: () => OrderReturn })
	@IsNotEmpty()
	@MultiORMManyToOne(() => OrderReturn, (it) => it.lines, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	return?: IOrderReturn;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrderReturnLine) => it.return)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	returnId?: ID;

	/**
	 * Line-level reason, overriding the header's when the tenant records reasons per item.
	 */
	@ApiPropertyOptional({ type: () => OrderReturnReason })
	@IsOptional()
	@MultiORMManyToOne(() => OrderReturnReason, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	reason?: IOrderReturnReason;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrderReturnLine) => it.reason)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	reasonId?: ID;

	/**
	 * Receiving location for this line, when it differs from the header's.
	 */
	@ApiPropertyOptional({ type: () => Warehouse })
	@IsOptional()
	@MultiORMManyToOne(() => Warehouse, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	warehouse?: IWarehouse;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrderReturnLine) => it.warehouse)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	warehouseId?: ID;
}
