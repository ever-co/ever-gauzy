import { BaseEntityModel, IBasePerTenantAndOrganizationEntityModel, ID, IPayment, IUser } from '@gauzy/contracts';
import type { IPluginBilling } from './plugin-billing.model';
import { PluginScope } from './plugin-scope.model';
import { IPluginTenant } from './plugin-tenant.model';
import { IPlugin } from './plugin.model';

/**
 * Interface for plugin subscription plans
 */
export interface IPluginSubscriptionPlan extends BaseEntityModel {
	// Plan name
	name: string;

	// Plan description
	description?: string;

	// Subscription type/plan level
	type: PluginSubscriptionType;

	// Plan price
	price: number;

	// Currency code (e.g., USD, EUR)
	currency: string;

	// Billing period
	billingPeriod: PluginBillingPeriod;

	// Plan features list
	features: string[];

	// Plan limitations and quotas
	limitations?: Record<string, any>;

	// Whether the plan is active and available for purchase
	isActive: boolean;

	// Whether this plan is marked as popular
	isPopular?: boolean;

	// Whether this plan is recommended
	isRecommended?: boolean;

	// Trial period duration in days
	trialDays?: number;

	// Setup fee for the plan
	setupFee?: number;

	// Discount percentage for the plan
	discountPercentage?: number;

	// Plan metadata
	metadata?: Record<string, any>;

	// Sort order for displaying plans
	sortOrder?: number;

	// The plugin this plan belongs to
	plugin?: IPlugin;
	pluginId: ID;

	// User who created this plan
	createdBy?: IUser;
	createdById?: ID;

	// Subscriptions using this plan
	subscriptions?: IPluginSubscription[];
}

/**
 * Interface for plugin subscriptions
 */
export interface IPluginSubscription extends IBasePerTenantAndOrganizationEntityModel {
	// Subscription status
	status: PluginSubscriptionStatus;

	// Subscription scope (tenant, organization, user)
	scope: PluginScope;

	// Start date of subscription
	startDate: Date;

	// End date of subscription (null for active subscriptions)
	endDate?: Date;

	// Trial period end date (if applicable)
	trialEndDate?: Date;

	// Whether auto-renewal is enabled
	autoRenew: boolean;

	// External subscription ID from payment provider
	externalSubscriptionId?: string;

	// Cancellation date (if cancelled)
	cancelledAt?: Date;

	// Cancellation reason
	cancellationReason?: string;

	// The plugin this subscription is for
	plugin: IPlugin;
	pluginId: ID;

	// The plugin tenant relationship
	pluginTenant: IPluginTenant;
	pluginTenantId: ID;

	// User who subscribed (for user-level subscriptions)
	subscriber?: IUser;
	subscriberId?: ID;

	// Subscription metadata for additional data
	metadata?: Record<string, any>;

	// Subscription plan (if subscription is based on a specific plan)
	plan?: IPluginSubscriptionPlan;
	planId?: ID;

	// Parent-child subscription relationships for hierarchical management
	parent?: IPluginSubscription;
	parentId?: ID;
	children?: IPluginSubscription[];

	// Billing records for this subscription
	billings?: IPluginBilling[];

	// Payment records for this subscription (when payment system is implemented)
	payments?: IPayment[];
}

/**
 * Enum for plugin subscription status
 */
export enum PluginSubscriptionStatus {
	ACTIVE = 'active',
	TRIAL = 'trial',
	EXPIRED = 'expired',
	CANCELLED = 'cancelled',
	SUSPENDED = 'suspended',
	PENDING = 'pending'
}

/**
 * Enum for plugin subscription types
 */
export enum PluginSubscriptionType {
	FREE = 'free',
	TRIAL = 'trial',
	BASIC = 'basic',
	PREMIUM = 'premium',
	ENTERPRISE = 'enterprise',
	CUSTOM = 'custom'
}

/**
 * Enum for billing periods
 */
export enum PluginBillingPeriod {
	DAILY = 'daily',
	WEEKLY = 'weekly',
	MONTHLY = 'monthly',
	QUARTERLY = 'quarterly',
	YEARLY = 'yearly',
	ONE_TIME = 'one-time',
	USAGE_BASED = 'usage_based'
}

/**
 * Interface for creating plugin subscriptions
 */
export interface IPluginSubscriptionCreateInput {
	// Core subscription details
	status: PluginSubscriptionStatus;
	scope: PluginScope;
	startDate: Date;
	endDate?: Date;
	trialEndDate?: Date;
	autoRenew: boolean;

	// Cancellation details
	cancelledAt?: Date;
	cancellationReason?: string;

	// Metadata
	metadata?: Record<string, any>;

	// External subscription ID
	externalSubscriptionId?: string;

	// Relationships
	pluginId: ID;
	pluginTenantId: ID;
	subscriberId?: ID;
	planId?: ID;

	// Parent-child subscription hierarchy
	parentId?: ID;

	// Base entity fields
	tenantId?: ID;
	organizationId?: ID;
}

/**
 * Interface for updating plugin subscriptions
 */
export interface IPluginSubscriptionUpdateInput
	extends Partial<Omit<IPluginSubscriptionCreateInput, 'pluginId' | 'pluginTenantId' | 'billings'>> {}

/**
 * Interface for finding plugin subscriptions
 */
export interface IPluginSubscriptionFindInput
	extends Partial<Pick<IPluginSubscription, 'status' | 'scope' | 'pluginId' | 'pluginTenantId' | 'subscriberId'>> {}

/**
 * Interface for subscription purchase request
 */
export interface IPluginSubscriptionPurchaseInput {
	pluginId: ID;
	planId?: ID;
	scope: PluginScope;
	autoRenew: boolean;
	paymentMethod?: string;
	promoCode?: string;
	metadata?: Record<string, any>;
}

/**
 * Interface for creating plugin subscription plans
 */
export interface IPluginSubscriptionPlanCreateInput
	extends Omit<IPluginSubscriptionPlan, 'id' | 'createdAt' | 'updatedAt' | 'plugin' | 'createdBy' | 'subscriptions'> {
	pluginId: ID;
	createdById?: ID;
}

/**
 * Interface for updating plugin subscription plans
 */
export interface IPluginSubscriptionPlanUpdateInput
	extends Partial<Omit<IPluginSubscriptionPlanCreateInput, 'pluginId'>> {}

/**
 * Interface for finding plugin subscription plans
 */
export interface IPluginSubscriptionPlanFindInput
	extends Partial<
		Pick<
			IPluginSubscriptionPlan,
			'type' | 'isActive' | 'pluginId' | 'isPopular' | 'isRecommended' | 'billingPeriod'
		>
	> {}
