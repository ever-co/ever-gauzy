import { IBasePerTenantAndOrganizationEntityModel, ID, IUser, IPayment } from '@gauzy/contracts';
import { IPlugin } from './plugin.model';
import { IPluginTenant } from './plugin-tenant.model';
import { PluginScope } from './plugin-scope.model';

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

	// Price per billing period
	price: number;

	// Currency code
	currency: string;

	// Start date of subscription
	startDate: Date;

	// End date of subscription (null for active subscriptions)
	endDate?: Date;

	// Next billing date
	nextBillingDate?: Date;

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

	// Payment records for this subscription
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
		'id' | 'createdAt' | 'updatedAt' | 'plugin' | 'pluginTenant' | 'subscriber' | 'payments'
	> {
	pluginId: ID;
	pluginTenantId: ID;
	subscriberId?: ID;
}

/**
 * Interface for updating plugin subscriptions
 */
export interface IPluginSubscriptionUpdateInput
	extends Partial<Omit<IPluginSubscriptionCreateInput, 'pluginId' | 'pluginTenantId'>> {}

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
 * Interface for subscription billing information
 */
export interface IPluginSubscriptionBilling {
	subscriptionId: ID;
	amount: number;
	currency: string;
	billingDate: Date;
	dueDate: Date;
	status: PluginBillingStatus;
	paymentMethod?: string;
	invoiceUrl?: string;
	metadata?: string;
}

/**
 * Enum for billing status
 */
export enum PluginBillingStatus {
	PENDING = 'pending',
	PAID = 'paid',
	OVERDUE = 'overdue',
	FAILED = 'failed',
	REFUNDED = 'refunded'
}

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
