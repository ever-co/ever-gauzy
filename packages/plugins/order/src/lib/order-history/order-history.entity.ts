import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID, IOrderHistory } from '@gauzy/contracts';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { Order } from '../order/order.entity';
import { MikroOrmOrderHistoryRepository } from './repository/mikro-orm-order-history.repository';

/**
 * The order's own timeline.
 *
 * The platform already has a general audit trail (`activity_log`) and this table is not a second one:
 * it is the order's *readable* story, written by the order's own subscribers so that every state
 * transition produces an entry regardless of which surface caused it. **Append-only**: a row is never
 * updated and never deleted while its order exists.
 */
@MultiORMEntity('order_history', { mikroOrmRepository: () => MikroOrmOrderHistoryRepository })
export class OrderHistory extends TenantOrganizationBaseEntity implements IOrderHistory {
	/** The order. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	orderId: ID;

	/** The machine action key, for example `ORDER_PLACED` or `CHANGE_CONFIRMED`. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	action: string;

	/** A human title for the timeline. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ nullable: true })
	title?: string;

	/** The longer explanation. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, type: 'text' })
	description?: string;

	/** The actor. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	userId?: ID;

	/** The action's payload fragment. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** The order. */
	@MultiORMManyToOne(() => Order, (it) => it.history, { onDelete: 'CASCADE' })
	@JoinColumn()
	order?: Order;
}
