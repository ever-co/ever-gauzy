import { Injectable } from '@angular/core';
import {
	IPluginSubscription,
	IPluginSubscriptionPlan,
	PluginSubscriptionStatus,
	PluginSubscriptionType
} from '../../../../services/plugin-subscription.service';

export enum PlanActionType {
	NEW = 'new',
	UPGRADE = 'upgrade',
	DOWNGRADE = 'downgrade',
	CURRENT = 'current'
}

export interface IPlanComparisonResult {
	actionType: PlanActionType;
	isValidAction: boolean;
	requiresPayment: boolean;
	prorationAmount?: number;
	canProceed: boolean;
	restrictions: string[];
	benefits: string[];
}

/**
 * Service responsible for plan comparison logic
 * Follows SOLID principle: Single Responsibility - handles plan comparison business logic
 */
@Injectable({
	providedIn: 'root'
})
export class PlanComparisonService {
	/**
	 * Plan hierarchy for comparison
	 * Higher values indicate higher-tier plans
	 */
	private readonly planHierarchy: Record<PluginSubscriptionType, number> = {
		[PluginSubscriptionType.FREE]: 0,
		[PluginSubscriptionType.TRIAL]: 1,
		[PluginSubscriptionType.BASIC]: 2,
		[PluginSubscriptionType.PREMIUM]: 3,
		[PluginSubscriptionType.ENTERPRISE]: 4,
		[PluginSubscriptionType.CUSTOM]: 5
	};

	/**
	 * Compare two plans and determine the action type
	 */
	public comparePlans(
		currentSubscription: IPluginSubscription | null,
		selectedPlan: IPluginSubscriptionPlan
	): IPlanComparisonResult {
		// No current subscription - this is a new subscription
		if (!currentSubscription) {
			return this.createNewSubscriptionResult(selectedPlan);
		}

		// Current subscription exists
		const currentType = currentSubscription.plan?.type;
		const selectedType = selectedPlan.type;

		// If current plan is undefined, treat as new subscription
		if (!currentType) {
			return this.createNewSubscriptionResult(selectedPlan);
		}

		// Same plan type - current plan
		if (currentType === selectedType && this.isSamePlan(currentSubscription, selectedPlan)) {
			return this.createCurrentPlanResult(currentSubscription, selectedPlan);
		}

		// Different plans - determine if upgrade or downgrade based on sortOrder
		const isUpgrade = this.isPlanUpgrade(currentSubscription, selectedPlan);

		if (isUpgrade) {
			return this.createUpgradeResult(currentSubscription, selectedPlan);
		} else {
			return this.createDowngradeResult(currentSubscription, selectedPlan);
		}
	}

	/**
	 * Check if the selected plan is the same as the current subscription plan
	 */
	private isSamePlan(subscription: IPluginSubscription, plan: IPluginSubscriptionPlan): boolean {
		// Check if subscription has a plan ID
		if (subscription.planId) {
			return subscription.planId === plan.id;
		}

		// Check using plan object if available
		if (subscription.plan) {
			return subscription.plan.id === plan.id;
		}

		// Fall back to type and billing period comparison
		const currentType = subscription.plan?.type;
		const currentBillingPeriod = subscription.plan?.billingPeriod;
		const currentAmount = subscription.plan?.price;

		if (!currentType || !currentBillingPeriod) {
			return false;
		}

		const planPrice = this.parsePriceAsNumber(plan.price);

		return currentType === plan.type && currentBillingPeriod === plan.billingPeriod && currentAmount === planPrice;
	}

	/**
	 * Determine if the plan change is an upgrade based on sortOrder
	 * If sortOrder is not available, fall back to type-based hierarchy
	 */
	private isPlanUpgrade(currentSubscription: IPluginSubscription, newPlan: IPluginSubscriptionPlan): boolean {
		// Get current plan sortOrder from the plan object if available
		const currentSortOrder = currentSubscription.plan?.sortOrder;
		const newSortOrder = newPlan.sortOrder;

		// If both sortOrders are available, use them for comparison
		if (currentSortOrder !== undefined && newSortOrder !== undefined) {
			return newSortOrder > currentSortOrder;
		}

		// Fall back to type-based hierarchy
		// Use plan.type if available, otherwise use legacy subscriptionType
		const currentType = currentSubscription.plan?.type || currentSubscription.plan.type;
		const newType = newPlan.type;

		if (!currentType) {
			// If we can't determine current type, consider it an upgrade
			return true;
		}

		return this.planHierarchy[newType] > this.planHierarchy[currentType];
	}

	/**
	 * Create result for new subscription
	 */
	private createNewSubscriptionResult(selectedPlan: IPluginSubscriptionPlan): IPlanComparisonResult {
		const planPrice = this.parsePriceAsNumber(selectedPlan.price);
		const isFree = selectedPlan.type === PluginSubscriptionType.FREE || planPrice === 0;

		return {
			actionType: PlanActionType.NEW,
			isValidAction: true,
			requiresPayment: !isFree,
			canProceed: true,
			restrictions: [],
			benefits: [
				'Access to all plan features',
				...(selectedPlan.trialDays ? [`${selectedPlan.trialDays} days free trial`] : []),
				'Can cancel anytime'
			]
		};
	}

	/**
	 * Create result for current plan selection
	 */
	private createCurrentPlanResult(
		subscription: IPluginSubscription,
		plan: IPluginSubscriptionPlan
	): IPlanComparisonResult {
		const isActive = [
			PluginSubscriptionStatus.ACTIVE,
			PluginSubscriptionStatus.PENDING,
			PluginSubscriptionStatus.TRIAL
		].includes(subscription.status);

		return {
			actionType: PlanActionType.CURRENT,
			isValidAction: false,
			requiresPayment: false,
			canProceed: false,
			restrictions: ['This is your current plan', ...(isActive ? [] : ['Subscription is not active'])],
			benefits: []
		};
	}

	/**
	 * Create result for upgrade
	 */
	private createUpgradeResult(
		currentSubscription: IPluginSubscription,
		selectedPlan: IPluginSubscriptionPlan
	): IPlanComparisonResult {
		const prorationAmount = this.calculateProrationAmount(currentSubscription, selectedPlan);
		const canUpgrade = this.canUpgradeFromCurrentPlan(currentSubscription);

		const benefits = [
			'Immediate access to upgraded features',
			'Pay only the prorated difference',
			'No interruption to current subscription'
		];

		const restrictions: string[] = [];
		if (!canUpgrade) {
			restrictions.push('Current subscription does not allow upgrades');
		}

		return {
			actionType: PlanActionType.UPGRADE,
			isValidAction: canUpgrade,
			requiresPayment: prorationAmount > 0,
			prorationAmount,
			canProceed: canUpgrade,
			restrictions,
			benefits
		};
	}

	/**
	 * Create result for downgrade
	 */
	private createDowngradeResult(
		currentSubscription: IPluginSubscription,
		selectedPlan: IPluginSubscriptionPlan
	): IPlanComparisonResult {
		const canDowngrade = this.canDowngradeFromCurrentPlan(currentSubscription);

		const benefits = [
			'Lower monthly cost',
			'Change takes effect at next billing cycle',
			'Continue with current features until then'
		];

		const restrictions: string[] = [];
		if (!canDowngrade) {
			restrictions.push('Current subscription does not allow downgrades');
		}

		// Add feature loss warnings
		const featureDifferences = this.getFeatureDifferences(currentSubscription, selectedPlan);
		if (featureDifferences.length > 0) {
			restrictions.push(`You will lose access to: ${featureDifferences.join(', ')}`);
		}

		return {
			actionType: PlanActionType.DOWNGRADE,
			isValidAction: canDowngrade,
			requiresPayment: false, // Downgrades typically don't require immediate payment
			canProceed: canDowngrade,
			restrictions,
			benefits
		};
	}

	/**
	 * Check if current subscription allows upgrades
	 */
	private canUpgradeFromCurrentPlan(subscription: IPluginSubscription): boolean {
		// Can upgrade if subscription is active or trial
		const allowedStatuses = [
			PluginSubscriptionStatus.ACTIVE,
			PluginSubscriptionStatus.TRIAL,
			PluginSubscriptionStatus.PENDING
		];
		return allowedStatuses.includes(subscription.status);
	}

	/**
	 * Check if current subscription allows downgrades
	 */
	private canDowngradeFromCurrentPlan(subscription: IPluginSubscription): boolean {
		// Can downgrade if subscription is active (not during trial)
		return subscription.status === PluginSubscriptionStatus.ACTIVE;
	}

	/**
	 * Calculate proration amount for upgrade
	 */
	private calculateProrationAmount(
		currentSubscription: IPluginSubscription,
		newPlan: IPluginSubscriptionPlan
	): number {
		const newPrice = this.parsePriceAsNumber(newPlan.price);

		if (!currentSubscription.endDate) {
			return newPrice; // Full price if no billing date
		}

		const now = new Date();
		const nextBilling = new Date(currentSubscription.endDate);
		const daysRemaining = Math.ceil((nextBilling.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

		if (daysRemaining <= 0) {
			return newPrice; // Full price if billing is due
		}

		// Calculate daily rates
		// Use plan.price if available, otherwise fall back to subscription.amount
		const currentPlan = currentSubscription.plan;
		if (!currentPlan) {
			return newPrice; // no plan info, fallback to full price
		}
		const currentAmount = this.parsePriceAsNumber(currentPlan.price) || 0;
		const currentBillingPeriod = currentPlan.billingPeriod;

		if (!currentBillingPeriod) {
			return newPrice; // Can't calculate proration without billing period
		}

		const currentDailyRate =
			this.parsePriceAsNumber(currentAmount) / this.getBillingPeriodDays(currentBillingPeriod);
		const newDailyRate = newPrice / this.getBillingPeriodDays(newPlan.billingPeriod);

		// Return prorated difference
		const prorationAmount = (newDailyRate - currentDailyRate) * daysRemaining;
		return Math.max(0, prorationAmount); // Ensure non-negative
	}

	/**
	 * Parse price as number (handles both string and number types)
	 */
	private parsePriceAsNumber(price: number | string): number {
		if (typeof price === 'number') {
			return price;
		}
		return parseFloat(price) || 0;
	}

	/**
	 * Get billing period in days
	 */
	private getBillingPeriodDays(period: string): number {
		const periodDays: Record<string, number> = {
			daily: 1,
			weekly: 7,
			monthly: 30,
			quarterly: 90,
			yearly: 365,
			'one-time': 365
		};

		return periodDays[period] || 30;
	}

	/**
	 * Get features that will be lost in downgrade
	 */
	private getFeatureDifferences(subscription: IPluginSubscription, newPlan: IPluginSubscriptionPlan): string[] {
		// This would ideally compare current subscription features with new plan features
		// For now, we'll return generic warnings based on plan types
		const currentType = subscription.plan?.type;

		if (!currentType) {
			return [];
		}

		const currentTier = this.planHierarchy[currentType];
		const newTier = this.planHierarchy[newPlan.type];

		if (newTier >= currentTier) {
			return []; // No features lost if not downgrading
		}

		// Generic feature differences - in a real app, this would be more specific
		const potentialLosses = [];

		if (currentType === PluginSubscriptionType.ENTERPRISE && newPlan.type !== PluginSubscriptionType.ENTERPRISE) {
			potentialLosses.push('Enterprise support', 'Advanced analytics');
		}

		if (
			currentType === PluginSubscriptionType.PREMIUM &&
			[PluginSubscriptionType.BASIC, PluginSubscriptionType.FREE].includes(newPlan.type)
		) {
			potentialLosses.push('Premium features', 'Priority support');
		}

		return potentialLosses;
	}

	/**
	 * Get user-friendly action description
	 */
	public getActionDescription(result: IPlanComparisonResult, planName: string): string {
		switch (result.actionType) {
			case PlanActionType.NEW:
				return `Subscribe to ${planName}`;
			case PlanActionType.UPGRADE:
				return `Upgrade to ${planName}`;
			case PlanActionType.DOWNGRADE:
				return `Downgrade to ${planName}`;
			case PlanActionType.CURRENT:
				return 'Current Plan';
			default:
				return 'Select Plan';
		}
	}

	/**
	 * Get action button variant based on action type
	 */
	public getActionButtonVariant(result: IPlanComparisonResult): 'primary' | 'success' | 'warning' | 'basic' {
		switch (result.actionType) {
			case PlanActionType.NEW:
				return 'primary';
			case PlanActionType.UPGRADE:
				return 'success';
			case PlanActionType.DOWNGRADE:
				return 'warning';
			case PlanActionType.CURRENT:
				return 'basic';
			default:
				return 'basic';
		}
	}

	/**
	 * Check if plan selection should be disabled
	 */
	public isPlanSelectionDisabled(result: IPlanComparisonResult): boolean {
		return result.actionType === PlanActionType.CURRENT || !result.isValidAction;
	}
}
