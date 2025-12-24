import { IPlugin } from '@gauzy/contracts';
// Plugin Subscription Actions for @ngneat/effects
import { createAction } from '@ngneat/effects';
import {
	IPluginSubscription,
	IPluginSubscriptionCreateInput,
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

	public static openSubscriptionManagement = createAction(
		'[Plugin Subscription] Manage Subscription Dialog',
		(plugin: IPlugin, clicked: boolean = false) => ({
			plugin,
			clicked
		})
	);

	public static resetError = createAction('[Plugin Subscription] Reset Error');

	public static resetState = createAction('[Plugin Subscription] Reset State');

	// Current subscription state actions
	public static setCurrentPluginSubscription = createAction(
		'[Plugin Subscription] Set Current Plugin Subscription',
		(pluginId: string, subscription: IPluginSubscription | null) => ({ pluginId, subscription })
	);

	public static openHierarchySubscriptions = createAction(
		'[Plugin Subscription] Hierarchy Subscriptions',
		(plugin: IPlugin) => ({
			plugin
		})
	);
}
