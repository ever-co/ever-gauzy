import { IBasePerTenantAndOrganizationEntityModel, ID, IPayment, IUser } from '@gauzy/contracts';
import type { IPluginBilling } from './plugin-billing.model';
import { PluginScope } from './plugin-scope.model';
import { IPluginTenant } from './plugin-tenant.model';
import { IPlugin } from './plugin.model';

/**
 * Interface for plugin subscriptions
 */
export interface IPluginSubscription extends IBasePerTenantAndOrganizationEntityModel {
	// Subscription status
	status: PluginSubscriptionStatus;

	// Subscription type/plan
	subscriptionType: PluginSubscriptionType;

	// Subscription scope (tenant, organization, user)
	scope: PluginScope;

	// Billing period
	billingPeriod: PluginBillingPeriod;

	// Start date of subscription
	startDate: Date;

	// End date of subscription (null for active subscriptions)
	endDate?: Date;

	// Trial period end date (if applicable)
	trialEndDate?: Date;

	// Whether auto-renewal is enabled
	autoRenew: boolean;

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

	// Subscription metadata (JSON string for flexibility)
	metadata?: string;

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
	PENDING = 'pending',
	FAILED = 'failed'
}

/**
 * Enum for plugin subscription types
 */
export enum PluginSubscriptionType {
	FREE = 'free',
	BASIC = 'basic',
	PREMIUM = 'premium',
	ENTERPRISE = 'enterprise',
	CUSTOM = 'custom'
}

/**
 * Enum for billing periods
 */
export enum PluginBillingPeriod {
	MONTHLY = 'monthly',
	YEARLY = 'yearly',
	QUARTERLY = 'quarterly',
	WEEKLY = 'weekly',
	ONE_TIME = 'one_time',
	USAGE_BASED = 'usage_based'
}

/**
 * Interface for creating plugin subscriptions
 */
export interface IPluginSubscriptionCreateInput
	extends Omit<
		IPluginSubscription,
		'id' | 'createdAt' | 'updatedAt' | 'plugin' | 'pluginTenant' | 'subscriber' | 'payments' | 'billings'
	> {
	pluginId: ID;
	pluginTenantId: ID;
	subscriberId?: ID;
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
	extends Partial<
		Pick<
			IPluginSubscription,
			'status' | 'subscriptionType' | 'scope' | 'pluginId' | 'pluginTenantId' | 'subscriberId'
		>
	> {}

/**
 * Interface for subscription purchase request
 */
export interface IPluginSubscriptionPurchaseInput {
	pluginId: ID;
	subscriptionType: PluginSubscriptionType;
	billingPeriod: PluginBillingPeriod;
	scope: PluginScope;
	autoRenew: boolean;
	paymentMethod?: string;
	promoCode?: string;
	metadata?: string;
}
