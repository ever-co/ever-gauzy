import { IBasePerTenantAndOrganizationEntityModel, ID } from '@gauzy/contracts';
import type { IPluginSubscription } from './plugin-subscription.model';

/**
 * Interface for plugin billing records
 */
export interface IPluginBilling extends IBasePerTenantAndOrganizationEntityModel {
	// Associated subscription
	subscription: IPluginSubscription;
	subscriptionId: ID;

	// Billing amount
	amount: number;

	// Currency code
	currency: string;

	// Billing date
	billingDate: Date;

	// Due date for payment
	dueDate: Date;

	// Billing status
	status: PluginBillingStatus;

	// Billing period information
	billingPeriod: PluginBillingPeriod;
	billingPeriodStart: Date;
	billingPeriodEnd: Date;

	// Billing description/notes
	description?: string;

	// Billing metadata
	metadata?: Record<string, any>;
}

/**
 * Enum for plugin billing status
 */
export enum PluginBillingStatus {
	PENDING = 'pending',
	PROCESSED = 'processed',
	PAID = 'paid',
	OVERDUE = 'overdue',
	FAILED = 'failed',
	CANCELLED = 'cancelled',
	REFUNDED = 'refunded',
	PARTIALLY_PAID = 'partially_paid'
}

// Import billing period from subscription model
import { PluginBillingPeriod } from './plugin-subscription.model';

/**
 * Interface for creating plugin billing records
 */
export interface IPluginBillingCreateInput
	extends Omit<IPluginBilling, 'id' | 'createdAt' | 'updatedAt' | 'subscription'> {
	subscriptionId: ID;
}

/**
 * Interface for updating plugin billing records
 */
export interface IPluginBillingUpdateInput extends Partial<Omit<IPluginBillingCreateInput, 'subscriptionId'>> {}

/**
 * Interface for finding plugin billing records
 */
export interface IPluginBillingFindInput
	extends Partial<Pick<IPluginBilling, 'subscriptionId' | 'status' | 'billingPeriod' | 'currency' | 'billingDate'>> {
	dateRange?: {
		start: Date;
		end: Date;
	};
	amountRange?: {
		min: number;
		max: number;
	};
}

/**
 * Interface for billing summary/statistics
 */
export interface IPluginBillingSummary {
	subscriptionId: ID;
	totalBillings: number;
	totalAmount: number;
	paidAmount: number;
	pendingAmount: number;
	overdueAmount: number;
	currency: string;
	lastBillingDate?: Date;
	nextBillingDate?: Date;
}
