import { Injectable } from '@angular/core';
import { PluginBillingPeriod } from '../../../../../services/plugin-subscription.service';
import { PlanFormatterService } from '../../../plugin-subscription-plan-selection';

/**
 * Service for formatting subscription plan data
 * Handles currency, billing period, and other display formatting
 *
 * @principle Single Responsibility - Only handles formatting operations
 */
@Injectable({
	providedIn: 'root'
})
export class SubscriptionPlanFormatService extends PlanFormatterService {
	/**
	 * Formats a number as currency using browser's Intl API
	 */
	public formatCurrency(amount: number, currency: string = 'USD'): string {
		try {
			return new Intl.NumberFormat(undefined, {
				style: 'currency',
				currency: currency || 'USD'
			}).format(amount ?? 0);
		} catch (error) {
			// Fallback if currency is invalid
			return `${currency} ${amount.toFixed(2)}`;
		}
	}

	/**
	 * Formats billing period as readable text
	 */
	public formatBillingPeriod(period: PluginBillingPeriod): string {
		const periodMap: Record<PluginBillingPeriod, string> = {
			[PluginBillingPeriod.DAILY]: 'day',
			[PluginBillingPeriod.WEEKLY]: 'week',
			[PluginBillingPeriod.MONTHLY]: 'month',
			[PluginBillingPeriod.QUARTERLY]: 'quarter',
			[PluginBillingPeriod.YEARLY]: 'year',
			[PluginBillingPeriod.ONE_TIME]: 'one-time'
		};

		return periodMap[period] ?? period;
	}

	/**
	 * Formats price with billing period
	 * Example: "$9.99 / month"
	 */
	public formatPriceWithPeriod(price: number, currency: string, billingPeriod: PluginBillingPeriod): string {
		if (price === 0) {
			return 'Free';
		}

		const formattedPrice = this.formatCurrency(price, currency);
		const formattedPeriod = this.formatBillingPeriod(billingPeriod);

		return `${formattedPrice} / ${formattedPeriod}`;
	}
}
