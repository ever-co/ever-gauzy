import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID, IOrderChangeAction, OrderChangeActionType } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { OrderChange } from '../order-change/order-change.entity';
import { MikroOrmOrderChangeActionRepository } from './repository/mikro-orm-order-change-action.repository';

/**
 * One action inside a change.
 *
 * Actions are **validated as a set before any of them runs** — a `FULFILLMENT_CREATE` must not
 * reference a line that a later `ITEM_REMOVE` deletes — and then applied in `ordering` sequence inside
 * one transaction. A change is therefore either fully applied or not applied at all, and
 * `applied = true` always implies `appliedAt` is set.
 */
@MultiORMEntity('order_change_action', {
	mikroOrmRepository: () => MikroOrmOrderChangeActionRepository
})
export class OrderChangeAction extends TenantOrganizationBaseEntity implements IOrderChangeAction {
	/** The change. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	changeId: ID;

	/** What the action does. */
	@ApiProperty({ type: () => String, enum: OrderChangeActionType })
	@IsEnum(OrderChangeActionType)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: OrderChangeActionType })
	action: OrderChangeActionType;

	/** The action's payload: the new quantity, the address, the credit amount. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	details?: Record<string, unknown>;

	/** The money delta this action contributes to the order. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true, type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	amount?: number;

	/** The kind of row the action targets. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 64 })
	referenceType?: string;

	/**
	 * The row the action targets. No constraint: the target may be a line that the same change creates,
	 * in which case no row with that id exists yet when this row is written.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	referenceId?: ID;

	/** Application order inside the change. Unique per change in practice. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 0 })
	ordering: number;

	/** Whether the action has been applied. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	applied: boolean;

	/** When it was applied. Set if and only if `applied` is true. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	appliedAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** The change. */
	@MultiORMManyToOne(() => OrderChange, (it) => it.actions, { onDelete: 'CASCADE' })
	@JoinColumn()
	change?: OrderChange;
}
