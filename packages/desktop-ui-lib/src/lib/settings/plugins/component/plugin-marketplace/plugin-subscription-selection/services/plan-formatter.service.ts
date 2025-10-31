import { Injectable } from '@angular/core';
import {
	IPluginSubscriptionPlan,
	PluginBillingPeriod,
	PluginSubscriptionType
} from '../../../../services/plugin-subscription.service';
import { IPlanViewModel, ISubscriptionPreviewViewModel } from '../models/plan-view.model';

/**
 * Service responsible for formatting plan data for display
 * Follows SOLID principle: Single Responsibility - handles formatting logic only
 */
@Injectable({
	providedIn: 'root'
})
export class PlanFormatterService {
	/**
	 * Transform a plan to a view model
	 */
	public transformToViewModel(plan: IPluginSubscriptionPlan): IPlanViewModel {
		return {
			id: plan.id,
			name: plan.name,
			description: plan.description,
			type: plan.type,
			price: plan.price,
			currency: plan.currency,
			billingPeriod: plan.billingPeriod,
			features: plan.features,
			limitations: plan.limitations,
			formattedPrice: this.formatPrice(plan.price, plan.currency),
			formattedBillingPeriod: this.formatBillingPeriod(plan.billingPeriod),
			icon: this.getPlanTypeIcon(plan.type),
			colorStatus: this.getPlanTypeColor(plan.type),
			isPopular: plan.isPopular || false,
			isRecommended: plan.isRecommended || false,
			isFree: plan.type === PluginSubscriptionType.FREE || plan.price === 0,
			trialDays: plan.trialDays,
			trialText: plan.trialDays ? `${plan.trialDays} days free trial` : undefined,
			setupFee: plan.setupFee,
			formattedSetupFee: plan.setupFee ? this.formatPrice(plan.setupFee, plan.currency) : undefined,
			discountPercentage: plan.discountPercentage,
			originalPlan: plan
		};
	}

	/**
	 * Transform multiple plans to view models
	 */
	public transformToViewModels(plans: IPluginSubscriptionPlan[]): IPlanViewModel[] {
		return plans.map((plan) => this.transformToViewModel(plan));
	}

	/**
	 * Create a subscription preview view model
	 */
	public createPreviewViewModel(
		plan: IPluginSubscriptionPlan,
		promoDiscount: number = 0
	): ISubscriptionPreviewViewModel {
		const baseAmount = Number(plan.price);
		const setupFee = Number(plan.setupFee) || 0;

		// Calculate plan discount if applicable
		const planDiscount = plan.discountPercentage ? (baseAmount * plan.discountPercentage) / 100 : 0;

		// Calculate subtotal after plan discount
		const subtotal = baseAmount - planDiscount + setupFee;

		// Calculate final total, ensuring it's not negative
		const totalAmount = Math.max(0, subtotal - promoDiscount);

		return {
			planName: plan.name,
			baseAmount,
			formattedBaseAmount: this.formatPrice(baseAmount, plan.currency),
			setupFee,
			formattedSetupFee: this.formatPrice(setupFee, plan.currency),
			discount: promoDiscount,
			formattedDiscount: this.formatPrice(promoDiscount, plan.currency),
			totalAmount,
			formattedTotalAmount: this.formatPrice(totalAmount, plan.currency),
			currency: plan.currency,
			billingPeriod: plan.billingPeriod,
			formattedBillingPeriod: this.formatBillingPeriod(plan.billingPeriod),
			trialDays: plan.trialDays,
			trialText: plan.trialDays ? `${plan.trialDays} days` : undefined,
			features: plan.features,
			isFree: plan.type === PluginSubscriptionType.FREE || plan.price === 0
		};
	}

	/**
	 * Format price with currency
	 */
	public formatPrice(amount: number, currency: string): string {
		try {
			return new Intl.NumberFormat(undefined, {
				style: 'currency',
				currency: currency || 'USD',
				minimumFractionDigits: 0,
				maximumFractionDigits: 2
			}).format(amount);
		} catch (error) {
			return `${currency} ${amount.toFixed(2)}`;
		}
	}

	/**
	 * Format billing period
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

		return periodMap[period] || period;
	}

	/**
	 * Get icon for plan type
	 */
	public getPlanTypeIcon(type: PluginSubscriptionType): string {
		const iconMap: Record<PluginSubscriptionType, string> = {
			[PluginSubscriptionType.FREE]: 'gift-outline',
			[PluginSubscriptionType.TRIAL]: 'clock-outline',
			[PluginSubscriptionType.BASIC]: 'person-outline',
			[PluginSubscriptionType.PREMIUM]: 'star-outline',
			[PluginSubscriptionType.ENTERPRISE]: 'briefcase-outline',
			[PluginSubscriptionType.CUSTOM]: 'settings-outline'
		};

		return iconMap[type] || 'info-outline';
	}

	/**
	 * Get color status for plan type
	 */
	public getPlanTypeColor(type: PluginSubscriptionType): string {
		const colorMap: Record<PluginSubscriptionType, string> = {
			[PluginSubscriptionType.FREE]: 'success',
			[PluginSubscriptionType.TRIAL]: 'info',
			[PluginSubscriptionType.BASIC]: 'basic',
			[PluginSubscriptionType.PREMIUM]: 'warning',
			[PluginSubscriptionType.ENTERPRISE]: 'danger',
			[PluginSubscriptionType.CUSTOM]: 'primary'
		};

		return colorMap[type] || 'basic';
	}

	/**
	 * Format limitation key to human readable text
	 */
	public formatLimitationKey(key: string): string {
		return key
			.replace(/([A-Z])/g, ' $1')
			.replace(/^./, (str) => str.toUpperCase())
			.trim();
	}

	/**
	 * Format limitation value
	 */
	public formatLimitationValue(value: any): string {
		if (typeof value === 'number') {
			return value.toLocaleString();
		}
		return String(value);
	}
}
