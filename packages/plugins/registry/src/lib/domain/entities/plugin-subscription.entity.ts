import { IUser } from '@gauzy/contracts';
import {
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity,
	User
} from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsDate,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Min,
	ValidateIf
} from 'class-validator';
import { Index, JoinColumn, Relation, RelationId, Tree, TreeChildren, TreeParent } from 'typeorm';
import { IPluginBilling } from '../../shared/models';
import { PluginScope } from '../../shared/models/plugin-scope.model';
import {
	IPluginSubscription,
	IPluginSubscriptionPlan,
	PluginBillingPeriod,
	PluginSubscriptionStatus,
	PluginSubscriptionType
} from '../../shared/models/plugin-subscription.model';
import type { IPluginTenant } from '../../shared/models/plugin-tenant.model';
import type { IPlugin } from '../../shared/models/plugin.model';

@MultiORMEntity('plugin_subscriptions')
@Tree('closure-table')
@Index(['pluginId', 'tenantId', 'organizationId'], { unique: false })
@Index(['subscriberId', 'tenantId'], { unique: false })
@Index(['status', 'endDate'], { unique: false })
@Index(['nextBillingDate'], { unique: false })
@Index(['externalSubscriptionId'], { unique: false })
@Index(['parentId'], { unique: false })
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

	@ApiPropertyOptional({ type: Object, description: 'Subscription metadata for additional data' })
	@IsOptional()
	@IsObject({ message: 'Metadata must be an object' })
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, any>;

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
	@RelationId((subscription: PluginSubscription) => subscription.plugin)
	@MultiORMColumn({ type: 'uuid', nullable: false, relationId: true })
	pluginId: string;

	@MultiORMManyToOne(() => 'Plugin', {
		onDelete: 'CASCADE',
		nullable: false,
		eager: false
	})
	@JoinColumn()
	plugin: Relation<IPlugin>;

	/*
	 * Plugin Tenant relationship - Enhanced with proper constraints
	 */
	@ApiProperty({ type: String, description: 'Plugin Tenant ID' })
	@IsNotEmpty({ message: 'Plugin Tenant ID is required' })
	@IsUUID(4, { message: 'Plugin Tenant ID must be a valid UUID' })
	@MultiORMColumn({ type: 'uuid', nullable: false, relationId: true })
	@RelationId((subscription: PluginSubscription) => subscription.pluginTenant)
	pluginTenantId: string;

	@MultiORMManyToOne(() => 'PluginTenant', {
		onDelete: 'CASCADE',
		nullable: false,
		eager: false
	})
	@JoinColumn()
	pluginTenant: Relation<IPluginTenant>;

	/*
	 * Subscription Plan relationship
	 */
	@ApiPropertyOptional({ type: String, description: 'Subscription plan ID' })
	@IsOptional()
	@IsUUID(4, { message: 'Plan ID must be a valid UUID' })
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	@RelationId((subscription: PluginSubscription) => subscription.plan)
	planId?: string;

	@MultiORMManyToOne(() => 'PluginSubscriptionPlan', 'subscriptions', {
		onDelete: 'SET NULL',
		nullable: true,
		eager: false
	})
	@JoinColumn()
	plan?: Relation<IPluginSubscriptionPlan>;

	/*
	 * Subscriber (User) relationship - Enhanced for user-level subscriptions
	 */
	@ApiPropertyOptional({ type: String, description: 'Subscriber user ID for user-specific subscriptions' })
	@IsOptional()
	@IsUUID(4, { message: 'Subscriber ID must be a valid UUID' })
	@ValidateIf((object, value) => value !== null)
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	@RelationId((subscription: PluginSubscription) => subscription.subscriber)
	subscriberId?: string;

	@MultiORMManyToOne(() => User, {
		onDelete: 'SET NULL',
		nullable: true,
		eager: false
	})
	@JoinColumn()
	subscriber?: Relation<IUser>;

	/*
	 * Parent-Child Subscription Relationships
	 * Used for hierarchical subscription management where tenant/organization subscriptions
	 * can have child user subscriptions created through assignment
	 */

	/**
	 * Parent subscription ID - References the tenant/organization subscription that spawned this user subscription
	 * Only set for user subscriptions created through assignment from a parent subscription
	 */
	@ApiPropertyOptional({ type: String, description: 'Parent subscription ID for hierarchical subscriptions' })
	@IsOptional()
	@IsUUID(4, { message: 'Parent subscription ID must be a valid UUID' })
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	@RelationId((subscription: PluginSubscription) => subscription.parent)
	parentId?: string;

	/**
	 * Parent subscription relationship
	 * The tenant/organization subscription that this user subscription was derived from
	 */
	@ApiPropertyOptional({
		type: () => PluginSubscription,
		description: 'Parent subscription (for subscriptions created through assignment)'
	})
	@TreeParent()
	@MultiORMManyToOne(() => PluginSubscription, (subscription) => subscription.children, {
		onDelete: 'CASCADE',
		nullable: true
	})
	@JoinColumn()
	parent?: Relation<IPluginSubscription>;

	/**
	 * Child subscriptions relationship
	 * User subscriptions that were created through assignment from this tenant/organization subscription
	 */
	@ApiPropertyOptional({
		type: () => [PluginSubscription],
		description: 'Child subscriptions (user subscriptions created through assignment)'
	})
	@TreeChildren()
	@MultiORMOneToMany(() => PluginSubscription, (subscription) => subscription.parent, {
		cascade: true
	})
	children?: Relation<IPluginSubscription[]>;

	/*
	 * Billing relationships - inverse relationship for PluginBilling
	 */
	@ApiPropertyOptional({ type: () => Array, description: 'Plugin billings for this subscription' })
	@MultiORMOneToMany(() => 'PluginBilling', 'subscription', {
		onDelete: 'CASCADE'
	})
	billings?: Relation<IPluginBilling[]>;
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
