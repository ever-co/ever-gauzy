import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { JoinColumn, RelationId } from 'typeorm';
import { ISubscriptionBilling, SubscriptionBillingStatus } from '../subscription.types';
import { Subscription } from '../subscription/subscription.entity';
import { MikroOrmSubscriptionBillingRepository } from './repository/mikro-orm-subscription-billing.repository';

/**
 * One billing cycle's attempt and result.
 *
 * A cycle is a row, not a side effect: it is written in `PENDING` **before** any billing work
 * starts, so a crash mid-cycle leaves evidence of the period that was owed instead of silently
 * skipping it. Success, failure and every retry are recorded on the same row, so a cycle's history
 * is the row's own `attemptCount`, `lastError` and `nextRetryAt` rather than a second table.
 *
 * The unique `(subscriptionId, periodStart)` key is what makes a retried billing run idempotent, and
 * it is the whole reason the constraint exists: a second worker racing the first cannot create a
 * second row for one period, so it cannot charge for one period twice.
 *
 * `WAIVED` is deliberately distinct from `PAID`. A goodwill month and a paid month both produce no
 * money; recording them alike would overstate revenue.
 */
@MultiORMEntity('subscription_billing', { mikroOrmRepository: () => MikroOrmSubscriptionBillingRepository })
export class SubscriptionBilling extends TenantOrganizationBaseEntity implements ISubscriptionBilling {
	/**
	 * The order this cycle produced, once it has one. Set-null on delete: an archived order does not
	 * erase the fact that the period was billed.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	orderId?: ID;

	/** Instant the period being billed began. */
	@ApiProperty({ type: () => 'timestamptz' })
	@IsDate()
	@ColumnIndex()
	@MultiORMColumn({ nullable: false })
	periodStart: Date;

	/** Instant the period being billed ends. Always after `periodStart`. */
	@ApiProperty({ type: () => 'timestamptz' })
	@IsDate()
	@MultiORMColumn({ nullable: false })
	periodEnd: Date;

	/**
	 * The recurring amount for the period: the sum of the lines' `quantity × unitPrice`, less the
	 * plan's discount. A discount granted on a cycle is an adjustment pointing at this row, never a
	 * smaller `amount`, so the reduction stays auditable.
	 */
	@ApiProperty({ type: () => String, description: 'Exact decimal string, e.g. "120.000000".' })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	amount: DecimalString;

	/** Currency of the amount. */
	@ApiProperty({ type: () => String, maxLength: 3 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: CurrencyCode;

	/** Where the cycle stands. */
	@ApiProperty({ type: () => String, enum: SubscriptionBillingStatus })
	@IsEnum(SubscriptionBillingStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: SubscriptionBillingStatus.PENDING })
	status: SubscriptionBillingStatus;

	/** When the cycle became payable. An unpaid row past this instant is overdue. */
	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	dueAt?: Date;

	/** When the payment settled; non-null exactly when the cycle is `PAID`. */
	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	paidAt?: Date;

	/** How many attempts the cycle has used, across every retry of the dunning schedule. */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	attemptCount: number;

	/** Why the last attempt failed, in the provider's or the platform's own words. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string;

	/**
	 * When the next dunning attempt is owed. The billing run reads it rather than re-deriving the
	 * schedule, so an operator reading the row can see exactly when the customer will be charged
	 * again without reconstructing the policy.
	 */
	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	nextRetryAt?: Date;

	/** Open-ended extras: the payer the attempt used, the adjustments granted on the cycle. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The subscription the cycle belongs to. Cascading, so deleting a subscription removes the
	 * billing history that describes it.
	 */
	@ApiProperty({ type: () => Subscription })
	@MultiORMManyToOne(() => Subscription, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: false,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	subscription?: Subscription;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: SubscriptionBilling) => it.subscription)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	subscriptionId: ID;
}
