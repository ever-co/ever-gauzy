import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { ISubscription, ISubscriptionBilling, ISubscriptionItem, SubscriptionStatus } from '../subscription.types';
import { SubscriptionBilling } from '../subscription-billing/subscription-billing.entity';
import { SubscriptionItem } from '../subscription-item/subscription-item.entity';
import { MikroOrmSubscriptionRepository } from './repository/mikro-orm-subscription.repository';

/**
 * One running agreement with a customer.
 *
 * The row carries three things and nothing else: **who and what** (`planId`, `customerId`,
 * `originOrderId`), **where in the calendar it is** (`status`, the current period, `nextBillingAt`
 * and `billingCycleCount`) and **who pays for it** (`paymentAccountHolderId`,
 * `paymentMethodTokenId`).
 *
 * The payer is recorded at creation from the payment that completed the originating order, so a
 * renewal never has to re-derive it from an order that may since have been archived. Losing it is
 * not fatal and not destructive: the subscription moves into dunning with a named reason instead of
 * billing nobody.
 *
 * `nextBillingAt` is non-null exactly while the subscription is billing, which is what makes the
 * due-billing scan an index seek rather than a table scan.
 */
@MultiORMEntity('subscription', { mikroOrmRepository: () => MikroOrmSubscriptionRepository })
export class Subscription extends TenantOrganizationBaseEntity implements ISubscription {
	/**
	 * The plan the subscription is on. Restricted rather than cascading: a plan a customer is paying
	 * for is not a row that may disappear underneath them.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: false })
	planId: ID;

	/**
	 * The subscriber. Restricted for the same reason a plan is: a subscription without a customer
	 * cannot bill, so deleting one is refused rather than cascaded.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: false })
	customerId: ID;

	/**
	 * The order that started the subscription, when there was one. Also the idempotency key of
	 * creation: a retried checkout finds this subscription instead of making a second one.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	originOrderId?: ID;

	/**
	 * The customer's account at the provider that renewals charge. Set-null on delete, because losing
	 * the account does not delete the agreement — it moves it into dunning.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	paymentAccountHolderId?: ID;

	/**
	 * The instrument renewals charge: the token the buyer used, or the holder's default resolved when
	 * this is null. Set-null on delete, and never a credential — a reference to one.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	paymentMethodTokenId?: ID;

	/** Where the agreement stands. */
	@ApiProperty({ type: () => String, enum: SubscriptionStatus })
	@IsEnum(SubscriptionStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: SubscriptionStatus.PENDING })
	status: SubscriptionStatus;

	/** Number of subscriptions to the plan, so a seat-based plan needs no second table. */
	@ApiProperty({ type: () => String, description: 'Exact decimal string, e.g. "1.000000".' })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 1 })
	quantity: DecimalString;

	/** Instant the period being billed began. */
	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	currentPeriodStart?: Date;

	/** Instant the period being billed ends. Always after `currentPeriodStart` when both are set. */
	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	currentPeriodEnd?: Date;

	/** The due-billing scan key, set while the subscription bills and cleared when it stops. */
	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	nextBillingAt?: Date;

	/** Cycles billed so far, which is what the plan's ceiling is measured against. */
	@ApiProperty({ type: () => Number, default: 0 })
	@MultiORMColumn({ type: 'int', default: 0 })
	billingCycleCount: number;

	/** Resume instant for a paused subscription; null means the pause is indefinite. */
	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	pausedUntil?: Date;

	/** When the customer or an operator ended it. */
	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	canceledAt?: Date;

	/** Why it ended, in the caller's words. */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ length: 255, nullable: true })
	cancelReason?: string;

	/** Currency every amount on the subscription is expressed in. */
	@ApiProperty({ type: () => String, maxLength: 3 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: CurrencyCode;

	/**
	 * Open-ended extras: the trial's end, whether the subscription ends with the current period, the
	 * plans whose setup fee was already charged, the periods a recovery skipped.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/** What each cycle bills. */
	@ApiPropertyOptional({ type: () => SubscriptionItem, isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => SubscriptionItem, (it) => it.subscription, { cascade: true })
	items?: ISubscriptionItem[];

	/** Every cycle that was billed, or attempted. Retained for the life of the subscription. */
	@ApiPropertyOptional({ type: () => SubscriptionBilling, isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => SubscriptionBilling, (it) => it.subscription, { cascade: true })
	billings?: ISubscriptionBilling[];
}
