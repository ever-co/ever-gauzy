import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID, IOrderTransaction, OrderTransactionType } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { Order } from '../order/order.entity';
import { MikroOrmOrderTransactionRepository } from './repository/mikro-orm-order-transaction.repository';

/**
 * The order's payment ledger: one row per movement of money against the order.
 *
 * **Append-only.** A row is never updated and never deleted; a correction is a new row of the opposite
 * kind, which is what makes the ledger reconcilable and auditable. The order's `paidTotal`,
 * `refundedTotal`, `outstandingTotal` and `paymentStatus` are all derived from these rows, inside the
 * same transaction that appends one.
 *
 * An `AUTHORIZATION` is deliberately *not* money received: only a `CAPTURE`, a `CREDIT` or a positive
 * `MANUAL` row increases the paid total, which is why the type is part of the aggregate rather than a
 * flag on it.
 */
@MultiORMEntity('order_transaction', { mikroOrmRepository: () => MikroOrmOrderTransactionRepository })
export class OrderTransaction extends TenantOrganizationBaseEntity implements IOrderTransaction {
	/**
	 * The order. An accounting record blocks deletion of its order rather than disappearing with it.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	orderId: ID;

	/** **Signed**: positive is charged to the customer, negative is refunded or credited. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	amount: number;

	/** The currency of the movement, which is the order's currency. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: string;

	/** What kind of movement this is. */
	@ApiProperty({ type: () => String, enum: OrderTransactionType })
	@IsEnum(OrderTransactionType)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: OrderTransactionType })
	type: OrderTransactionType;

	/** What produced the row: a payment, a refund, a gift card, a credit line, an operator. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 64 })
	referenceType?: string;

	/** The producing row. No constraint: the target may be a provider's row or another package's table. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	referenceId?: ID;

	/** A description shown to the customer. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ nullable: true })
	description?: string;

	/** When the movement happened. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	occurredAt?: Date;

	/** Who recorded it. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	createdByUserId?: ID;

	/** The provider's response fragment and the gateway reference, retained for reconciliation. */
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
	@MultiORMManyToOne(() => Order, (it) => it.transactions, { onDelete: 'CASCADE' })
	@JoinColumn()
	order?: Order;
}
