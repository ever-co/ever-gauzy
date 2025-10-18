import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsDate,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Min,
	ValidateIf
} from 'class-validator';
import { JoinColumn, Relation, RelationId, Index } from 'typeorm';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne, TenantOrganizationBaseEntity, User } from '@gauzy/core';
import { IUser } from '@gauzy/contracts';
import { IPluginSubscription } from '../../shared/models/plugin-subscription.model';
import { IPlugin } from '../../shared/models/plugin.model';
import { IPluginTenant } from '../../shared/models/plugin-tenant.model';
import {
	PluginSubscriptionStatus,
	PluginSubscriptionType,
	PluginBillingPeriod
} from '../../shared/models/plugin-subscription.model';
import { PluginScope } from '../../shared/models/plugin-scope.model';
import { Plugin } from './plugin.entity';
import { PluginTenant } from './plugin-tenant.entity';

@MultiORMEntity('plugin_subscriptions')
@Index(['pluginId', 'tenantId', 'organizationId'], { unique: false })
@Index(['subscriberId', 'tenantId'], { unique: false })
@Index(['status', 'endDate'], { unique: false })
@Index(['nextBillingDate'], { unique: false })
@Index(['externalSubscriptionId'], { unique: false })
export class PluginSubscription extends TenantOrganizationBaseEntity implements IPluginSubscription {
	@ApiProperty({ enum: PluginSubscriptionStatus, description: 'Subscription status' })
	@IsEnum(PluginSubscriptionStatus, { message: 'Invalid subscription status' })
	@MultiORMColumn({
		type: 'simple-enum',
		enum: PluginSubscriptionStatus,
		default: PluginSubscriptionStatus.PENDING
	})
	status: PluginSubscriptionStatus;

	@ApiProperty({ enum: PluginSubscriptionType, description: 'Subscription type/plan' })
	@IsEnum(PluginSubscriptionType, { message: 'Invalid subscription type' })
	@MultiORMColumn({
		type: 'simple-enum',
		enum: PluginSubscriptionType,
		default: PluginSubscriptionType.FREE
	})
	subscriptionType: PluginSubscriptionType;

	@ApiProperty({ enum: PluginScope, description: 'Subscription scope' })
	@IsEnum(PluginScope, { message: 'Invalid plugin scope' })
	@MultiORMColumn({ type: 'simple-enum', enum: PluginScope, default: PluginScope.TENANT })
	scope: PluginScope;

	@ApiProperty({ enum: PluginBillingPeriod, description: 'Billing period' })
	@IsEnum(PluginBillingPeriod, { message: 'Invalid billing period' })
	@MultiORMColumn({
		type: 'simple-enum',
		enum: PluginBillingPeriod,
		default: PluginBillingPeriod.MONTHLY
	})
	billingPeriod: PluginBillingPeriod;

	@ApiProperty({ type: Date, description: 'Start date of subscription' })
	@IsDate({ message: 'Start date must be a valid date' })
	@MultiORMColumn()
	startDate: Date;

	@ApiPropertyOptional({ type: Date, description: 'End date of subscription' })
	@IsOptional()
	@IsDate({ message: 'End date must be a valid date' })
	@MultiORMColumn({ nullable: true })
	endDate?: Date;

	@ApiPropertyOptional({ type: Date, description: 'Trial end date' })
	@IsOptional()
	@IsDate({ message: 'Trial end date must be a valid date' })
	@MultiORMColumn({ nullable: true })
	trialEndDate?: Date;

	@ApiProperty({ type: Boolean, description: 'Whether auto-renewal is enabled' })
	@IsBoolean({ message: 'autoRenew must be a boolean' })
	@MultiORMColumn({ type: 'boolean', default: true })
	autoRenew: boolean;

	@ApiPropertyOptional({ type: Date, description: 'Cancellation date' })
	@IsOptional()
	@IsDate({ message: 'Cancelled date must be a valid date' })
	@MultiORMColumn({ nullable: true })
	cancelledAt?: Date;

	@ApiPropertyOptional({ type: String, description: 'Cancellation reason' })
	@IsOptional()
	@IsString({ message: 'Cancellation reason must be a string' })
	@MultiORMColumn({ type: 'text', nullable: true })
	cancellationReason?: string;

	@ApiPropertyOptional({ type: String, description: 'Subscription metadata (JSON string)' })
	@IsOptional()
	@IsString({ message: 'Metadata must be a string' })
	@MultiORMColumn({ type: 'text', nullable: true })
	metadata?: string;

	@ApiPropertyOptional({ type: Number, description: 'Subscription price' })
	@IsOptional()
	@IsNumber({}, { message: 'Price must be a valid number' })
	@Min(0, { message: 'Price cannot be negative' })
	@MultiORMColumn({ type: 'decimal', precision: 10, scale: 2, default: 0 })
	price: number;

	@ApiPropertyOptional({ type: String, description: 'Currency code (e.g., USD, EUR)' })
	@IsOptional()
	@IsString({ message: 'Currency must be a string' })
	@MultiORMColumn({ type: 'varchar', length: 3, default: 'USD' })
	currency: string;

	@ApiPropertyOptional({ type: Date, description: 'Next billing date' })
	@IsOptional()
	@IsDate({ message: 'Next billing date must be a valid date' })
	@MultiORMColumn({ nullable: true })
	nextBillingDate?: Date;

	@ApiPropertyOptional({ type: String, description: 'External subscription ID from payment provider' })
	@IsOptional()
	@IsString({ message: 'External subscription ID must be a string' })
	@MultiORMColumn({ type: 'varchar', nullable: true })
	externalSubscriptionId?: string;

	/*
	 * Plugin relationship - Enhanced with proper constraints
	 */
	@ApiProperty({ type: String, description: 'Plugin ID' })
	@IsNotEmpty({ message: 'Plugin ID is required' })
	@IsUUID(4, { message: 'Plugin ID must be a valid UUID' })
	@MultiORMColumn({ type: 'uuid', nullable: false })
	@RelationId((pluginSubscription: PluginSubscription) => pluginSubscription.plugin)
	pluginId: string;

	@MultiORMManyToOne(() => Plugin, {
		onDelete: 'CASCADE',
		nullable: false,
		eager: false
	})
	@JoinColumn({ name: 'pluginId' })
	plugin: Relation<IPlugin>;

	/*
	 * Plugin Tenant relationship - Enhanced with proper constraints
	 */
	@ApiProperty({ type: String, description: 'Plugin Tenant ID' })
	@IsNotEmpty({ message: 'Plugin Tenant ID is required' })
	@IsUUID(4, { message: 'Plugin Tenant ID must be a valid UUID' })
	@MultiORMColumn({ type: 'uuid', nullable: false })
	@RelationId((pluginSubscription: PluginSubscription) => pluginSubscription.pluginTenant)
	pluginTenantId: string;

	@MultiORMManyToOne(() => PluginTenant, {
		onDelete: 'CASCADE',
		nullable: false,
		eager: false
	})
	@JoinColumn({ name: 'pluginTenantId' })
	pluginTenant: Relation<IPluginTenant>;

	/*
	 * Subscriber (User) relationship - Enhanced for user-level subscriptions
	 */
	@ApiPropertyOptional({ type: String, description: 'Subscriber user ID for user-specific subscriptions' })
	@IsOptional()
	@IsUUID(4, { message: 'Subscriber ID must be a valid UUID' })
	@ValidateIf((object, value) => value !== null)
	@MultiORMColumn({ type: 'uuid', nullable: true })
	@RelationId((pluginSubscription: PluginSubscription) => pluginSubscription.subscriber)
	subscriberId?: string;

	@MultiORMManyToOne(() => User, {
		onDelete: 'SET NULL',
		nullable: true,
		eager: false
	})
	@JoinColumn({ name: 'subscriberId' })
	subscriber?: Relation<IUser>;

	/*
	 * Billing relationships
	 * Note: Import moved to avoid circular dependency - will be added when needed
	 * @MultiORMOneToMany(() => PluginBilling, (billing) => billing.subscription, { onDelete: 'CASCADE' })
	 * billings?: IPluginBilling[];
	 */

	/*
	 * Payment relationships - will be added when Payment entity is available
	 * @MultiORMOneToMany(() => Payment, (payment) => payment.pluginSubscription, { onDelete: 'SET NULL' })
	 * payments?: IPayment[];
	 */

	/*
	 * Computed properties and helper methods
	 */

	/**
	 * Check if the subscription is currently active
	 */
	get isSubscriptionActive(): boolean {
		return this.status === PluginSubscriptionStatus.ACTIVE && (!this.endDate || this.endDate > new Date());
	}

	/**
	 * Check if the subscription is expired
	 */
	get isExpired(): boolean {
		return this.endDate ? this.endDate <= new Date() : false;
	}

	/**
	 * Check if the subscription is in trial period
	 */
	get isInTrial(): boolean {
		return this.trialEndDate ? this.trialEndDate > new Date() : false;
	}

	/**
	 * Check if the subscription is expiring soon (within 7 days)
	 */
	get isExpiringSoon(): boolean {
		if (!this.endDate) return false;
		const sevenDaysFromNow = new Date();
		sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
		return this.endDate <= sevenDaysFromNow && this.endDate > new Date();
	}

	/**
	 * Get days remaining until expiration
	 */
	get daysUntilExpiration(): number | null {
		if (!this.endDate) return null;
		const now = new Date();
		const timeDiff = this.endDate.getTime() - now.getTime();
		return Math.ceil(timeDiff / (1000 * 3600 * 24));
	}

	/**
	 * Check if billing is due
	 */
	get isBillingDue(): boolean {
		return this.nextBillingDate ? this.nextBillingDate <= new Date() : false;
	}
}
