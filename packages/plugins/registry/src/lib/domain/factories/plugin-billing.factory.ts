import { PluginBillingPeriod, PluginBillingStatus } from '@gauzy/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { IPluginBillingCreateInput } from '../../shared/models/plugin-billing.model';

/**
 * Factory for creating plugin billing records
 * Implements Factory Pattern to encapsulate complex billing creation logic
 *
 * Billing Calculation Rules:
 * 1. Initial Billing: Base Price - Discount + Setup Fee (one-time charges)
 * 2. Renewal Billing: Base Price ONLY (no discount, no setup fee)
 * 3. Upgrade Billing: Prorated amount based on price difference
 *
 * Discount Application:
 * - Applied ONLY to initial billing as a one-time promotional discount
 * - Discount amount = Base Price × (Discount % / 100)
 * - Effective Price = Base Price - Discount Amount
 *
 * Setup Fee:
 * - Only included in INITIAL billing
 * - NOT included in renewals or recurring charges
 *
 * Total Calculation:
 * - Initial: (Base Price - Discount) + Setup Fee = Total
 * - Renewal: Base Price = Total (full price, no discounts)
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
	 * Renewals use the FULL base price with NO discounts or setup fees
	 * @param subscriptionId - The subscription ID
	 * @param plan - The subscription plan
	 * @param tenantId - The tenant ID
	 * @param organizationId - The organization ID (optional)
	 * @returns Billing data for renewal
	 */
	async createForRenewal(
		subscriptionId: string,
		plan: any,
		tenantId?: string,
		organizationId?: string
	): Promise<IPluginBillingCreateInput> {
		this.logger.log(`Creating renewal billing for subscription: ${subscriptionId}`);

		const now = new Date();
		const billingPeriodStart = new Date(now);
		const billingPeriodEnd = this.calculateBillingPeriodEnd(billingPeriodStart, plan.billingPeriod);
		const dueDate = new Date(now);
		dueDate.setDate(dueDate.getDate() + 14); // 14 days to pay

		// Use full base price for renewals (no discount, no setup fee)
		// Convert to number (decimal columns may return strings from database)
		const basePrice = Number(plan.price) || 0;
		const totalAmount = basePrice;

		this.logger.log(
			`Renewal billing - Full price: ${totalAmount} ${plan.currency || 'USD'} (no discounts applied)`
		);

		return {
			subscriptionId,
			amount: totalAmount,
			currency: plan.currency || 'USD',
			billingDate: now,
			dueDate,
			status: PluginBillingStatus.PENDING,
			billingPeriod: plan.billingPeriod,
			billingPeriodStart,
			billingPeriodEnd,
			description: `Subscription renewal for ${plan.billingPeriod} period`,
			metadata: {
				type: 'renewal',
				basePrice: basePrice,
				note: 'Renewal uses full base price - no discounts or setup fees applied',
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
	 * Calculates total amount including setup fee and discounts
	 * @param subscriptionId - The subscription ID
	 * @param plan - The subscription plan with pricing details
	 * @param hasTrial - Whether the subscription has a trial period
	 * @param tenantId - The tenant ID
	 * @param organizationId - The organization ID (optional)
	 * @returns Billing data for initial subscription
	 */
	async createInitialBilling(
		subscriptionId: string,
		plan: any,
		hasTrial: boolean = false,
		tenantId?: string,
		organizationId?: string
	): Promise<IPluginBillingCreateInput> {
		this.logger.log(`Creating initial billing for subscription: ${subscriptionId}`);

		const now = new Date();
		const billingDate = hasTrial ? this.addDaysToDate(now, plan.trialDays || 14) : now; // Delay billing if trial
		const billingPeriodStart = new Date(billingDate);
		const billingPeriodEnd = this.calculateBillingPeriodEnd(billingPeriodStart, plan.billingPeriod);
		const dueDate = this.addDaysToDate(billingDate, 14);

		// Calculate billing amount with setup fee and discount
		const billingCalculation = this.calculateBillingAmount(plan, true); // true = include setup fee for initial billing

		return {
			subscriptionId,
			amount: billingCalculation.totalAmount,
			currency: plan.currency || 'USD',
			billingDate,
			dueDate,
			status: PluginBillingStatus.PENDING,
			billingPeriod: plan.billingPeriod,
			billingPeriodStart,
			billingPeriodEnd,
			description: hasTrial ? 'Initial billing after trial period' : 'Initial subscription billing',
			metadata: {
				type: 'initial',
				hasTrial,
				basePrice: plan.price,
				setupFee: billingCalculation.setupFee,
				discountPercentage: plan.discountPercentage,
				discountAmount: billingCalculation.discountAmount,
				effectivePrice: billingCalculation.effectivePrice,
				subtotal: billingCalculation.subtotal,
				breakdown: billingCalculation.breakdown,
				createdVia: 'factory',
				createdAt: now.toISOString()
			},
			tenantId,
			organizationId
		};
	}

	/**
	 * Calculate billing amount with setup fee, discounts, and other options
	 * NOTE: This is only used for INITIAL billing. Renewals use full base price.
	 * @param plan - The subscription plan
	 * @param includeSetupFee - Whether to include setup fee (typically only for initial billing)
	 * @returns Calculated billing amounts and breakdown
	 */
	private calculateBillingAmount(
		plan: any,
		includeSetupFee: boolean = false
	): {
		basePrice: number;
		discountAmount: number;
		effectivePrice: number;
		setupFee: number;
		subtotal: number;
		totalAmount: number;
		breakdown: string;
	} {
		// Convert to numbers (decimal columns may return strings from database)
		const basePrice = Number(plan.price) || 0;
		const discountPercentage = Number(plan.discountPercentage) || 0;
		const setupFee = includeSetupFee ? Number(plan.setupFee) || 0 : 0;

		// Calculate discount amount (only for initial billing)
		const discountAmount = basePrice * (discountPercentage / 100);

		// Calculate effective price after discount
		const effectivePrice = basePrice - discountAmount;

		// Calculate subtotal (effective price + setup fee)
		const subtotal = effectivePrice + setupFee;

		// Total amount (same as subtotal for now, can add taxes later)
		const totalAmount = subtotal;

		// Create breakdown string
		const breakdownParts: string[] = [];
		breakdownParts.push(`Base Price: ${basePrice.toFixed(2)} ${plan.currency || 'USD'}`);

		if (discountPercentage > 0) {
			breakdownParts.push(
				`One-time Discount (${discountPercentage}%): -${discountAmount.toFixed(2)} ${plan.currency || 'USD'}`
			);
			breakdownParts.push(`Effective Price: ${effectivePrice.toFixed(2)} ${plan.currency || 'USD'}`);
		}

		if (setupFee > 0) {
			breakdownParts.push(`Setup Fee: ${setupFee.toFixed(2)} ${plan.currency || 'USD'}`);
		}

		breakdownParts.push(`Total: ${totalAmount.toFixed(2)} ${plan.currency || 'USD'}`);
		breakdownParts.push('(Note: Discounts and setup fees apply only to initial billing)');

		const breakdown = breakdownParts.join(' | ');

		this.logger.debug(`Initial billing calculation: ${breakdown}`);

		return {
			basePrice,
			discountAmount,
			effectivePrice,
			setupFee,
			subtotal,
			totalAmount,
			breakdown
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
