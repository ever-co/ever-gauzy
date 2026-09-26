import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, IOrderChange, OrderChangeStatus, OrderChangeType } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { Order } from '../order/order.entity';
import { OrderChangeAction } from '../order-change-action/order-change-action.entity';
import { MikroOrmOrderChangeRepository } from './repository/mikro-orm-order-change.repository';

/**
 * A post-placement modification of an order.
 *
 * **The rule this table exists to enforce:** no service mutates a placed order, its lines, its shipping
 * methods or its addresses outside this path. Every edit, return, claim, exchange, credit,
 * cancellation, transfer and fulfilment creation is one change carrying an ordered list of typed
 * actions, validated as a set and applied atomically.
 *
 * **The exclusivity rule:** at most one change per order may be in a non-terminal status (`PENDING`,
 * `REQUESTED`, `CONFIRMED`) at any moment. It is enforced twice — by a partial unique index on the
 * dialects that support one, and by taking `SELECT ... FOR UPDATE` on the order row before the change
 * is created — because a read-then-write check alone lets two concurrent requests both pass.
 *
 * **Undo is a change, not an edit.** Reversing an applied change inserts a new change of type `UNDO`
 * whose actions are the inverse of the reversed change's, in reverse order, and moves the reversed
 * change to `UNDONE`; every one of its rows is retained.
 */
@MultiORMEntity('order_change', { mikroOrmRepository: () => MikroOrmOrderChangeRepository })
export class OrderChange extends TenantOrganizationBaseEntity implements IOrderChange {
	/** The order. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	orderId: ID;

	/**
	 * The order version this change produces when it is applied.
	 *
	 * It is the **order aggregate's** version, announced by the change that will move it — never a lock
	 * of this row's own. A change carries no version of its own because every write to it happens inside
	 * a write of the order: the order's version is the one a caller states and the one the conditional
	 * update checks, so a second lock here would be a second answer to the same question, and the two
	 * would disagree the moment either of them moved. The index over this column is what answers "which
	 * change produced the order's version N?".
	 */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsInt()
	@MultiORMColumn({ type: 'int' })
	version: number;

	/** What kind of modification this is. */
	@ApiProperty({ type: () => String, enum: OrderChangeType })
	@IsEnum(OrderChangeType)
	@MultiORMColumn({ type: 'simple-enum', enum: OrderChangeType })
	changeType: OrderChangeType;

	/** Where the change is in its own lifecycle. */
	@ApiProperty({ type: () => String, enum: OrderChangeStatus })
	@IsEnum(OrderChangeStatus)
	@MultiORMColumn({ type: 'simple-enum', enum: OrderChangeStatus, default: OrderChangeStatus.PENDING })
	status: OrderChangeStatus;

	/**
	 * The return this change drives. The returns package is installed after this one, and a return that
	 * is deleted must not take the change with it.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	returnId?: ID;

	/** The claim this change drives. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	claimId?: ID;

	/** The exchange this change drives. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	exchangeId?: ID;

	/** The subscription this change converts the order into. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	subscriptionId?: ID;

	/** Who requested the change. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	requestedByUserId?: ID;

	/** Who confirmed it. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	confirmedByUserId?: ID;

	/** When it was requested. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	requestedAt?: Date;

	/** When it was confirmed. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	confirmedAt?: Date;

	/** When it was declined. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	declinedAt?: Date;

	/** When it was cancelled or found stale. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	canceledAt?: Date;

	/** A note about the change, shown on the order's timeline. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, type: 'text' })
	note?: string;

	/** The net delta this change applies to the order's grand total. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true, type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	priceChange?: number;

	/** Whether the payment and refund side of the change has settled. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isSettled: boolean;

	/**
	 * Open-ended payload: the preview totals the change was confirmed against, the decline reason, the
	 * payment-collection delta, and `undoOf` naming the change an `UNDO` change reverses.
	 */
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
	@MultiORMManyToOne(() => Order, (it) => it.changes, { onDelete: 'CASCADE' })
	@JoinColumn()
	order?: Order;

	/** The actions of the change, applied in `ordering` sequence inside one transaction. */
	@MultiORMOneToMany(() => OrderChangeAction, (it) => it.change, { onDelete: 'CASCADE' })
	actions?: OrderChangeAction[];
}
