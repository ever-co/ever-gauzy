import { Injectable, Logger } from '@nestjs/common';
import { IPluginBillingCreateInput, PluginBillingStatus } from '../../shared/models/plugin-billing.model';
import { PluginBillingPeriod } from '../../shared/models/plugin-subscription.model';

/**
 * Factory for creating plugin billing records
 * Implements Factory Pattern to encapsulate complex billing creation logic
 */
@Injectable()
export class PluginBillingFactory {
	private readonly logger = new Logger(PluginBillingFactory.name);

	/**
	 * Creates a billing record from input data with business logic applied
	 * @param input - The billing creation input
	 * @returns Billing data ready for persistence
	 */
	async createFromInput(input: IPluginBillingCreateInput): Promise<IPluginBillingCreateInput> {
		this.logger.log(`Creating billing record from input for subscription: ${input.subscriptionId}`);

		// Apply defaults
		const billingData: IPluginBillingCreateInput = {
			...input,
			currency: input.currency || 'USD',
			status: input.status || PluginBillingStatus.PENDING,
			billingDate: input.billingDate || new Date(),
			metadata: {
				...input.metadata,
				createdVia: 'factory',
				createdAt: new Date().toISOString()
			}
		};

		// Calculate due date if not provided (default 14 days from billing date)
		if (!billingData.dueDate) {
			const dueDate = new Date(billingData.billingDate);
			dueDate.setDate(dueDate.getDate() + 14);
			billingData.dueDate = dueDate;
		}

		// Set billing period dates if not provided
		if (!billingData.billingPeriodStart) {
			billingData.billingPeriodStart = new Date(billingData.billingDate);
		}

		if (!billingData.billingPeriodEnd) {
			billingData.billingPeriodEnd = this.calculateBillingPeriodEnd(
				billingData.billingPeriodStart,
				billingData.billingPeriod
			);
		}

		return billingData;
	}

	/**
	 * Creates a billing record for a subscription renewal
	 * @param subscriptionId - The subscription ID
	 * @param amount - The billing amount
	 * @param billingPeriod - The billing period
	 * @param planPrice - The plan price
	 * @returns Billing data for renewal
	 */
	async createForRenewal(
		subscriptionId: string,
		amount: number,
		billingPeriod: PluginBillingPeriod,
		tenantId?: string,
		organizationId?: string
	): Promise<IPluginBillingCreateInput> {
		this.logger.log(`Creating renewal billing for subscription: ${subscriptionId}`);

		const now = new Date();
		const billingPeriodStart = new Date(now);
		const billingPeriodEnd = this.calculateBillingPeriodEnd(billingPeriodStart, billingPeriod);
		const dueDate = new Date(now);
		dueDate.setDate(dueDate.getDate() + 14); // 14 days to pay

		return {
			subscriptionId,
			amount,
			currency: 'USD',
			billingDate: now,
			dueDate,
			status: PluginBillingStatus.PENDING,
			billingPeriod,
			billingPeriodStart,
			billingPeriodEnd,
			description: `Subscription renewal for ${billingPeriod} period`,
			metadata: {
				type: 'renewal',
				createdVia: 'factory',
				createdAt: now.toISOString()
			},
			tenantId,
			organizationId
		};
	}

	/**
	 * Creates a billing record for a subscription upgrade
	 * @param subscriptionId - The subscription ID
	 * @param proratedAmount - The prorated upgrade amount
	 * @param billingPeriod - The billing period
	 * @returns Billing data for upgrade
	 */
	async createForUpgrade(
		subscriptionId: string,
		proratedAmount: number,
		billingPeriod: PluginBillingPeriod,
		tenantId?: string,
		organizationId?: string
	): Promise<IPluginBillingCreateInput> {
		this.logger.log(`Creating upgrade billing for subscription: ${subscriptionId}`);

		const now = new Date();
		const dueDate = new Date(now);
		dueDate.setDate(dueDate.getDate() + 7); // 7 days for upgrades

		return {
			subscriptionId,
			amount: proratedAmount,
			currency: 'USD',
			billingDate: now,
			dueDate,
			status: PluginBillingStatus.PENDING,
			billingPeriod,
			billingPeriodStart: now,
			billingPeriodEnd: this.calculateBillingPeriodEnd(now, billingPeriod),
			description: 'Prorated upgrade charge',
			metadata: {
				type: 'upgrade',
				prorated: true,
				createdVia: 'factory',
				createdAt: now.toISOString()
			},
			tenantId,
			organizationId
		};
	}

	/**
	 * Creates an initial billing record for a new subscription
	 * @param subscriptionId - The subscription ID
	 * @param amount - The initial billing amount
	 * @param billingPeriod - The billing period
	 * @param hasTrial - Whether the subscription has a trial period
	 * @returns Billing data for initial subscription
	 */
	async createInitialBilling(
		subscriptionId: string,
		amount: number,
		billingPeriod: PluginBillingPeriod,
		hasTrial: boolean = false,
		tenantId?: string,
		organizationId?: string
	): Promise<IPluginBillingCreateInput> {
		this.logger.log(`Creating initial billing for subscription: ${subscriptionId}`);

		const now = new Date();
		const billingDate = hasTrial ? this.addDaysToDate(now, 14) : now; // Delay billing if trial
		const billingPeriodStart = new Date(billingDate);
		const billingPeriodEnd = this.calculateBillingPeriodEnd(billingPeriodStart, billingPeriod);
		const dueDate = this.addDaysToDate(billingDate, 14);

		return {
			subscriptionId,
			amount,
			currency: 'USD',
			billingDate,
			dueDate,
			status: hasTrial ? PluginBillingStatus.PENDING : PluginBillingStatus.PENDING,
			billingPeriod,
			billingPeriodStart,
			billingPeriodEnd,
			description: hasTrial ? 'Initial billing after trial period' : 'Initial subscription billing',
			metadata: {
				type: 'initial',
				hasTrial,
				createdVia: 'factory',
				createdAt: now.toISOString()
			},
			tenantId,
			organizationId
		};
	}

	/**
	 * Calculates the billing period end date based on start date and period
	 * @param startDate - The billing period start date
	 * @param period - The billing period
	 * @returns The calculated end date
	 */
	private calculateBillingPeriodEnd(startDate: Date, period: PluginBillingPeriod): Date {
		const endDate = new Date(startDate);

		switch (period) {
			case PluginBillingPeriod.DAILY:
				endDate.setDate(endDate.getDate() + 1);
				break;
			case PluginBillingPeriod.WEEKLY:
				endDate.setDate(endDate.getDate() + 7);
				break;
			case PluginBillingPeriod.MONTHLY:
				endDate.setMonth(endDate.getMonth() + 1);
				break;
			case PluginBillingPeriod.QUARTERLY:
				endDate.setMonth(endDate.getMonth() + 3);
				break;
			case PluginBillingPeriod.YEARLY:
				endDate.setFullYear(endDate.getFullYear() + 1);
				break;
			case PluginBillingPeriod.ONE_TIME:
				// One-time billing has no end date
				return endDate;
			default:
				endDate.setMonth(endDate.getMonth() + 1); // Default to monthly
		}

		return endDate;
	}

	/**
	 * Helper to add days to a date
	 * @param date - The base date
	 * @param days - Number of days to add
	 * @returns New date with added days
	 */
	private addDaysToDate(date: Date, days: number): Date {
		const result = new Date(date);
		result.setDate(result.getDate() + days);
		return result;
	}
}
