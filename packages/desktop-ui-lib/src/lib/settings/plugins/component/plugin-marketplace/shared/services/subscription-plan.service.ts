import { Injectable } from '@angular/core';
import {
	IPluginSubscriptionPlan,
	PluginBillingPeriod,
	PluginSubscriptionType
} from '../../../../services/plugin-subscription.service';

/**
 * Service responsible for plan-related business logic
 * Following Single Responsibility Principle
 */
@Injectable({
	providedIn: 'root'
})
export class SubscriptionPlanService {
	/**
	 * Calculate subscription type hierarchy index
	 */
	getSubscriptionTypeIndex(type: PluginSubscriptionType): number {
		const order = [
			PluginSubscriptionType.FREE,
			PluginSubscriptionType.TRIAL,
			PluginSubscriptionType.BASIC,
			PluginSubscriptionType.PREMIUM,
			PluginSubscriptionType.ENTERPRISE
		];
		return order.indexOf(type);
	}

	/**
	 * Format plan price with period
	 */
	formatPlanPrice(plan: IPluginSubscriptionPlan): string {
		if (plan.price === 0) {
			return plan.type === PluginSubscriptionType.TRIAL ? 'Free Trial' : 'Free';
		}

		const period = this.getBillingPeriodLabel(plan.billingPeriod);
		return `$${plan.price}/${period}`;
	}

	/**
	 * Calculate savings for a plan
	 */
	calculatePlanSavings(plan: IPluginSubscriptionPlan): string | null {
		if (plan.billingPeriod === PluginBillingPeriod.YEARLY) {
			const price = Number(plan.price);
			const monthlyEquivalent = price / 12;
			const monthlySavings = (price * 1.2) / 12 - monthlyEquivalent;
			return `Save $${monthlySavings.toFixed(2)}/month`;
		}
		return null;
	}

	/**
	 * Get billing period label
	 */
	private getBillingPeriodLabel(period: PluginBillingPeriod): string {
		const labels = {
			[PluginBillingPeriod.YEARLY]: 'year',
			[PluginBillingPeriod.QUARTERLY]: 'quarter',
			[PluginBillingPeriod.MONTHLY]: 'month',
			[PluginBillingPeriod.WEEKLY]: 'week',
			[PluginBillingPeriod.DAILY]: 'day'
		};
		return labels[period] || 'month';
	}

	/**
	 * Compare two plans and determine action type
	 */
	comparePlans(
		currentPlan: IPluginSubscriptionPlan,
		targetPlan: IPluginSubscriptionPlan
	): 'upgrade' | 'downgrade' | 'same' {
		const currentIndex = currentPlan.sortOrder;
		const targetIndex = targetPlan.sortOrder;

		if (targetIndex > currentIndex) return 'upgrade';
		if (targetIndex < currentIndex) return 'downgrade';
		return 'same';
	}

	/**
	 * Check if plan can be upgraded
	 */
	canUpgrade(currentPlan: IPluginSubscriptionPlan, targetPlan: IPluginSubscriptionPlan): boolean {
		const currentIndex = currentPlan.sortOrder;
		const targetIndex = targetPlan.sortOrder;
		return targetIndex > currentIndex;
	}

	/**
	 * Check if plan can be downgraded
	 */
	canDowngrade(currentPlan: IPluginSubscriptionPlan, targetPlan: IPluginSubscriptionPlan): boolean {
		const currentIndex = currentPlan.sortOrder;
		const targetIndex = targetPlan.sortOrder;
		return targetIndex < currentIndex;
	}

	/**
	 * Calculate prorated amount for upgrade
	 */
	calculateProratedAmount(
		currentPlan: IPluginSubscriptionPlan,
		newPlan: IPluginSubscriptionPlan,
		daysRemaining: number
	): number {
		const daysInPeriod = this.getDaysInBillingPeriod(newPlan.billingPeriod);
		const proratedAmount = (Number(newPlan.price) - Number(currentPlan.price)) * (daysRemaining / daysInPeriod);
		return Math.max(0, proratedAmount);
	}

	/**
	 * Get number of days in billing period
	 */
	private getDaysInBillingPeriod(period: PluginBillingPeriod): number {
		const days = {
			[PluginBillingPeriod.DAILY]: 1,
			[PluginBillingPeriod.WEEKLY]: 7,
			[PluginBillingPeriod.MONTHLY]: 30,
			[PluginBillingPeriod.QUARTERLY]: 90,
			[PluginBillingPeriod.YEARLY]: 365
		};
		return days[period] || 30;
	}
}
