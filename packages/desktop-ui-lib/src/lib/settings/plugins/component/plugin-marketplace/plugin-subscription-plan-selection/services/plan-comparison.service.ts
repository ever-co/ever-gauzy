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
		const currentType = currentSubscription.subscriptionType;
		const selectedType = selectedPlan.type;

		// Same plan type - current plan
		if (currentType === selectedType && this.isSamePlan(currentSubscription, selectedPlan)) {
			return this.createCurrentPlanResult(currentSubscription, selectedPlan);
		}

		// Different plans - determine if upgrade or downgrade
		const isUpgrade = this.isPlanUpgrade(currentType, selectedType);

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

		// Fall back to type and billing period comparison
		return (
			subscription.subscriptionType === plan.type &&
			subscription.billingPeriod === plan.billingPeriod &&
			subscription.amount === plan.price
		);
	}

	/**
	 * Determine if the plan change is an upgrade
	 */
	private isPlanUpgrade(currentType: PluginSubscriptionType, newType: PluginSubscriptionType): boolean {
		return this.planHierarchy[newType] > this.planHierarchy[currentType];
	}

	/**
	 * Create result for new subscription
	 */
	private createNewSubscriptionResult(selectedPlan: IPluginSubscriptionPlan): IPlanComparisonResult {
		const isFree = selectedPlan.type === PluginSubscriptionType.FREE || selectedPlan.price === 0;

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
		const isActive = subscription.status === PluginSubscriptionStatus.ACTIVE;

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
		const allowedStatuses = [PluginSubscriptionStatus.ACTIVE, PluginSubscriptionStatus.TRIAL];
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
		if (!currentSubscription.nextBillingDate) {
			return newPlan.price; // Full price if no billing date
		}

		const now = new Date();
		const nextBilling = new Date(currentSubscription.nextBillingDate);
		const daysRemaining = Math.ceil((nextBilling.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

		if (daysRemaining <= 0) {
			return newPlan.price; // Full price if billing is due
		}

		// Calculate daily rates
		const currentDailyRate =
			currentSubscription.amount / this.getBillingPeriodDays(currentSubscription.billingPeriod);
		const newDailyRate = newPlan.price / this.getBillingPeriodDays(newPlan.billingPeriod);

		// Return prorated difference
		const prorationAmount = (newDailyRate - currentDailyRate) * daysRemaining;
		return Math.max(0, prorationAmount); // Ensure non-negative
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
		const currentTier = this.planHierarchy[subscription.subscriptionType];
		const newTier = this.planHierarchy[newPlan.type];

		if (newTier >= currentTier) {
			return []; // No features lost if not downgrading
		}

		// Generic feature differences - in a real app, this would be more specific
		const potentialLosses = [];

		if (
			subscription.subscriptionType === PluginSubscriptionType.ENTERPRISE &&
			newPlan.type !== PluginSubscriptionType.ENTERPRISE
		) {
			potentialLosses.push('Enterprise support', 'Advanced analytics');
		}

		if (
			subscription.subscriptionType === PluginSubscriptionType.PREMIUM &&
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
