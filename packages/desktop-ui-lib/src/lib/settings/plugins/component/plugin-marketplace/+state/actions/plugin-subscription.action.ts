// Plugin Subscription Actions for @ngneat/effects

import { createAction } from '@ngneat/effects';
import {
	IPluginSubscription,
	IPluginSubscriptionCreateInput,
	IPluginSubscriptionPlan,
	IPluginSubscriptionUpdateInput
} from '../../../../services/plugin-subscription.service';

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
}
