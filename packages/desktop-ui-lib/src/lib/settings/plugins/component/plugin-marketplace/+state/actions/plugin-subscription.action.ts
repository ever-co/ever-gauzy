// Plugin Subscription Actions for @ngneat/effects

import { createAction } from '@ngneat/effects';
import {
	IPluginSubscription,
	IPluginSubscriptionCreateInput,
	IPluginSubscriptionPlan,
	IPluginSubscriptionUpdateInput
} from '../../../../services/plugin-subscription.service';
import { PlanActionType } from '../../plugin-subscription-selection/services/plan-comparison.service';

export class PluginSubscriptionActions {
	// Load Plugin Subscriptions
	public static loadPluginSubscriptions = createAction(
		'[Plugin Subscription] Load Plugin Subscriptions',
		(pluginId: string) => ({ pluginId })
	);

	public static loadPluginSubscriptionsSuccess = createAction(
		'[Plugin Subscription] Load Plugin Subscriptions Success',
		(subscriptions: IPluginSubscription[]) => ({ subscriptions })
	);

	public static loadPluginSubscriptionsFailure = createAction(
		'[Plugin Subscription] Load Plugin Subscriptions Failure',
		(error: string) => ({ error })
	);

	// Load Plugin Plans
	public static loadPluginPlans = createAction('[Plugin Subscription] Load Plugin Plans', (pluginId: string) => ({
		pluginId
	}));

	public static loadPluginPlansSuccess = createAction(
		'[Plugin Subscription] Load Plugin Plans Success',
		(plans: IPluginSubscriptionPlan[]) => ({ plans })
	);

	public static loadPluginPlansFailure = createAction(
		'[Plugin Subscription] Load Plugin Plans Failure',
		(error: string) => ({ error })
	);

	// Create Subscription
	public static createSubscription = createAction(
		'[Plugin Subscription] Create Subscription',
		(pluginId: string, subscriptionData: IPluginSubscriptionCreateInput) => ({ pluginId, subscriptionData })
	);

	public static createSubscriptionSuccess = createAction(
		'[Plugin Subscription] Create Subscription Success',
		(subscription: IPluginSubscription) => ({ subscription })
	);

	public static createSubscriptionFailure = createAction(
		'[Plugin Subscription] Create Subscription Failure',
		(error: string) => ({ error })
	);

	// Update Subscription
	public static updateSubscription = createAction(
		'[Plugin Subscription] Update Subscription',
		(pluginId: string, subscriptionId: string, updates: IPluginSubscriptionUpdateInput) => ({
			pluginId,
			subscriptionId,
			updates
		})
	);

	public static updateSubscriptionSuccess = createAction(
		'[Plugin Subscription] Update Subscription Success',
		(subscription: IPluginSubscription) => ({ subscription })
	);

	public static updateSubscriptionFailure = createAction(
		'[Plugin Subscription] Update Subscription Failure',
		(error: string) => ({ error })
	);

	// Upgrade Subscription
	public static upgradeSubscription = createAction(
		'[Plugin Subscription] Upgrade Subscription',
		(pluginId: string, subscriptionId: string, newPlanId: string) => ({
			pluginId,
			subscriptionId,
			newPlanId
		})
	);

	public static upgradeSubscriptionSuccess = createAction(
		'[Plugin Subscription] Upgrade Subscription Success',
		(subscription: IPluginSubscription) => ({ subscription })
	);

	public static upgradeSubscriptionFailure = createAction(
		'[Plugin Subscription] Upgrade Subscription Failure',
		(error: string) => ({ error })
	);

	// Downgrade Subscription
	public static downgradeSubscription = createAction(
		'[Plugin Subscription] Downgrade Subscription',
		(pluginId: string, subscriptionId: string, newPlanId: string) => ({
			pluginId,
			subscriptionId,
			newPlanId
		})
	);

	public static downgradeSubscriptionSuccess = createAction(
		'[Plugin Subscription] Downgrade Subscription Success',
		(subscription: IPluginSubscription) => ({ subscription })
	);

	public static downgradeSubscriptionFailure = createAction(
		'[Plugin Subscription] Downgrade Subscription Failure',
		(error: string) => ({ error })
	);

	// Cancel Subscription
	public static cancelSubscription = createAction(
		'[Plugin Subscription] Cancel Subscription',
		(pluginId: string, subscriptionId: string) => ({ pluginId, subscriptionId })
	);

	public static cancelSubscriptionSuccess = createAction(
		'[Plugin Subscription] Cancel Subscription Success',
		(subscription: IPluginSubscription) => ({ subscription })
	);

	public static cancelSubscriptionFailure = createAction(
		'[Plugin Subscription] Cancel Subscription Failure',
		(error: string) => ({ error })
	);

	// Load Subscription Analytics
	public static loadSubscriptionAnalytics = createAction(
		'[Plugin Subscription] Load Subscription Analytics',
		(pluginId: string, dateRange?: { from: Date; to: Date }) => ({ pluginId, dateRange })
	);

	public static loadSubscriptionAnalyticsSuccess = createAction(
		'[Plugin Subscription] Load Subscription Analytics Success',
		(analytics: any) => ({ analytics })
	);

	public static loadSubscriptionAnalyticsFailure = createAction(
		'[Plugin Subscription] Load Subscription Analytics Failure',
		(error: string) => ({ error })
	);

	// UI Actions
	public static selectSubscription = createAction(
		'[Plugin Subscription] Select Subscription',
		(subscription: IPluginSubscription | null) => ({ subscription })
	);

	public static selectPlan = createAction(
		'[Plugin Subscription] Select Plan',
		(plan: IPluginSubscriptionPlan | null) => ({ plan })
	);

	public static showSubscriptionDialog = createAction(
		'[Plugin Subscription] Show Subscription Dialog',
		(pluginId: string) => ({ pluginId })
	);

	public static hideSubscriptionDialog = createAction('[Plugin Subscription] Hide Subscription Dialog');

	public static resetError = createAction('[Plugin Subscription] Reset Error');

	public static resetState = createAction('[Plugin Subscription] Reset State');

	// Plan CRUD Actions
	public static createPlan = createAction(
		'[Plugin Subscription] Create Plan',
		(planData: Omit<IPluginSubscriptionPlan, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>) => ({ planData })
	);

	public static createPlanSuccess = createAction(
		'[Plugin Subscription] Create Plan Success',
		(plan: IPluginSubscriptionPlan) => ({ plan })
	);

	public static createPlanFailure = createAction('[Plugin Subscription] Create Plan Failure', (error: string) => ({
		error
	}));

	public static updatePlan = createAction(
		'[Plugin Subscription] Update Plan',
		(planId: string, updates: Partial<IPluginSubscriptionPlan>) => ({ planId, updates })
	);

	public static updatePlanSuccess = createAction(
		'[Plugin Subscription] Update Plan Success',
		(plan: IPluginSubscriptionPlan) => ({ plan })
	);

	public static updatePlanFailure = createAction('[Plugin Subscription] Update Plan Failure', (error: string) => ({
		error
	}));

	public static deletePlan = createAction('[Plugin Subscription] Delete Plan', (planId: string) => ({ planId }));

	public static deletePlanSuccess = createAction('[Plugin Subscription] Delete Plan Success', (planId: string) => ({
		planId
	}));

	public static deletePlanFailure = createAction('[Plugin Subscription] Delete Plan Failure', (error: string) => ({
		error
	}));

	public static bulkCreatePlans = createAction(
		'[Plugin Subscription] Bulk Create Plans',
		(plansData: Array<Omit<IPluginSubscriptionPlan, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>>) => ({
			plansData
		})
	);

	public static bulkCreatePlansSuccess = createAction(
		'[Plugin Subscription] Bulk Create Plans Success',
		(plans: IPluginSubscriptionPlan[]) => ({ plans })
	);

	public static bulkCreatePlansFailure = createAction(
		'[Plugin Subscription] Bulk Create Plans Failure',
		(error: string) => ({ error })
	);

	// Plan comparison actions
	public static updatePlanComparison = createAction(
		'[Plugin Subscription] Update Plan Comparison',
		(comparison: {
			currentPlanId?: string | null;
			selectedPlanId?: string | null;
			actionType?: PlanActionType;
			isValidAction?: boolean;
			requiresPayment?: boolean;
			prorationAmount?: number;
		}) => ({ comparison })
	);

	public static resetPlanComparison = createAction('[Plugin Subscription] Reset Plan Comparison');

	public static setConfirmationStep = createAction(
		'[Plugin Subscription] Set Confirmation Step',
		(step: 'selection' | 'confirmation' | 'payment' | 'processing' | 'completed' | null) => ({ step })
	);

	// Current subscription state actions
	public static setCurrentPluginSubscription = createAction(
		'[Plugin Subscription] Set Current Plugin Subscription',
		(pluginId: string, subscription: IPluginSubscription | null) => ({ pluginId, subscription })
	);

	public static setCurrentPluginPlans = createAction(
		'[Plugin Subscription] Set Current Plugin Plans',
		(pluginId: string, plans: IPluginSubscriptionPlan[]) => ({ pluginId, plans })
	);
}
