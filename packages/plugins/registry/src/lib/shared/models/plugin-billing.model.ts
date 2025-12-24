import { ID, IPluginBilling as PluginBillingModel } from '@gauzy/contracts';

/**
 * Interface for plugin billing records
 */
export interface IPluginBilling extends PluginBillingModel {}

// Import billing period from subscription model

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
