import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { ISubscriptionPlan, SubscriptionBillingPeriod } from '../subscription.types';
import { MikroOrmSubscriptionPlanRepository } from './repository/mikro-orm-subscription-plan.repository';

/**
 * What can be subscribed to, and on what terms.
 *
 * A plan is four decisions in one row: **what** is delivered (`productId` or `variantId`), **how
 * often** it bills (`billingPeriod` × `billingInterval`), **what it costs to start** (`trialDays`,
 * `setupFee`) and **what it is worth per cycle** (the recurring discount, applied to whatever the
 * pricing pipeline resolves for the variant).
 *
 * What is deliberately *not* here is a price column. The recurring price is resolved through the
 * ordinary price pipeline on every cycle, so a customer price list, a contact-group price list and a
 * channel override all reach a renewal exactly as they reach a first purchase; a price copied onto
 * the plan would be a second answer to a question the pricing capability already answers.
 *
 * `code` is the tenant's own key for the plan and means one thing inside one organization, which is
 * why the unique index is scoped to the organization rather than to the table.
 */
@MultiORMEntity('subscription_plan', { mikroOrmRepository: () => MikroOrmSubscriptionPlanRepository })
export class SubscriptionPlan extends TenantOrganizationBaseEntity implements ISubscriptionPlan {
	/**
	 * What the plan is called on a price list and on an invoice.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ length: 255 })
	name: string;

	/**
	 * The tenant's own key for the plan. Unique per organization among the plans that are not
	 * soft-deleted, so a retired code can be reused without rewriting history.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ length: 64 })
	code: string;

	/** Operator- and customer-facing copy. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	/**
	 * Plan attached to a whole product. A product-level plan bills the product's default variant,
	 * which the catalogue resolves.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	productId?: ID;

	/**
	 * Plan attached to one variant. At most one of `productId` and `variantId` is set; a plan with
	 * neither is a pure service entitlement that delivers nothing the catalogue knows about.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	variantId?: ID;

	/** The unit the cadence is counted in. */
	@ApiProperty({ type: () => String, enum: SubscriptionBillingPeriod })
	@IsEnum(SubscriptionBillingPeriod)
	@MultiORMColumn({ type: 'varchar', length: 16, default: SubscriptionBillingPeriod.MONTHLY })
	billingPeriod: SubscriptionBillingPeriod;

	/** How many periods pass between two billings. Never below one. */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsNumber()
	@Min(1)
	@MultiORMColumn({ type: 'int', default: 1 })
	billingInterval: number;

	/** Cycles after which a subscription expires; null means it runs until it is cancelled. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Min(1)
	@MultiORMColumn({ type: 'int', nullable: true })
	maxBillingCycles?: number;

	/** Days the first period is free for. Null or zero means the subscription bills from the start. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ type: 'int', nullable: true })
	trialDays?: number;

	/** Charged once, with the first *paid* cycle — never on a trial and never on a renewal. */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "49.000000".' })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, nullable: true })
	setupFee?: DecimalString;

	/**
	 * Recurring discount as a fraction: `0.1` is ten per cent. Held as an exact decimal and applied
	 * through the adjustment ledger so the reduction stays visible rather than being baked into a
	 * unit price.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Fraction between 0 and 1, e.g. "0.100000".' })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'decimal', precision: 9, scale: 6, nullable: true })
	discountPercentage?: DecimalString;

	/** Currency the plan's amounts are expressed in. */
	@ApiProperty({ type: () => String, maxLength: 3 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: CurrencyCode;

	/**
	 * Open-ended extras: policy copy, the cancellation window, the dunning suspension policy.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	/*
	 * `isActive` — "may a new subscription be created from this plan?" — is the base class's own
	 * column and is deliberately not redeclared here. Deactivating a plan stops new subscriptions
	 * and leaves the ones already on it running, which is a rule the service enforces at creation
	 * rather than a second column.
	 */
}
