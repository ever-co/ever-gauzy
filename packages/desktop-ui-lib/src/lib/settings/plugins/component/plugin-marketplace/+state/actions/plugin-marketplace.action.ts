import { ID, IPlugin } from '@gauzy/contracts';
import { createAction } from '@ngneat/effects';
import { AnalyticsPeriod } from '../../../../services/plugin-analytics.service';
import { IPluginSecurity } from '../../../../services/plugin-security.service';
import { IPluginSubscription } from '../../../../services/plugin-subscription.service';
import { IPluginTag, IPluginTagCreateInput } from '../../../../services/plugin-tags.service';
import { IPluginFilter } from '../stores/plugin-market.store';

export interface IPaymentMethod {
	id: string;
	type: string;
	details: any;
}

export class PluginMarketplaceActions {
	// Core plugin actions
	public static readonly upload = createAction('[Plugin Marketplace] Upload');
	public static readonly getAll = createAction('[Plugin Marketplace] Get All', <T>(params?: T) => ({ params }));
	public static readonly getOne = createAction('[Plugin Marketplace] Get One', <T>(id: ID, params?: T) => ({
		id,
		params
	}));
	public static readonly update = createAction('[Plugin Marketplace] Update', (plugin: IPlugin) => ({
		plugin
	}));
	public static readonly delete = createAction('[Plugin Marketplace] Delete', (id: ID) => ({ id }));
	public static readonly reset = createAction('[Plugin Marketplace] Reset');

	// Search actions
	public static readonly search = createAction('[Plugin Marketplace] Search', (query: string) => ({ query }));

	// Installation actions
	public static readonly install = createAction(
		'[Plugin Marketplace] Install Plugin',
		(plugin: IPlugin, isUpdate: boolean = false) => ({
			plugin,
			isUpdate
		})
	);

	// Install update action
	public static readonly installUpdate = createAction('[Plugin Marketplace] Install Update', (plugin: IPlugin) => ({
		plugin
	}));

	public static readonly uninstall = createAction(
		'[Plugin Marketplace] Uninstall Plugin',
		(pluginId: ID, installationId: ID, reason?: string) => ({
			installationId,
			pluginId,
			reason
		})
	);

	// Filter actions
	public static readonly setFilters = createAction('[Plugin Marketplace] Set Filters', (filters: IPluginFilter) => ({
		filters
	}));
	public static readonly applyFilters = createAction('[Plugin Marketplace] Apply Filters');
	public static readonly clearFilters = createAction('[Plugin Marketplace] Clear Filters');
	public static readonly toggleAdvancedFilters = createAction(
		'[Plugin Marketplace] Toggle Advanced Filters',
		(show: boolean) => ({ show })
	);
	public static readonly setViewMode = createAction(
		'[Plugin Marketplace] Set View Mode',
		(view: 'grid' | 'list') => ({
			view
		})
	);

	// Tags actions
	public static readonly loadTags = createAction('[Plugin Marketplace] Load Tags');
	public static readonly createTag = createAction(
		'[Plugin Marketplace] Create Tag',
		(tag: IPluginTagCreateInput) => ({
			tag
		})
	);
	public static readonly updateTag = createAction(
		'[Plugin Marketplace] Update Tag',
		(id: ID, tag: Partial<IPluginTag>) => ({
			id,
			tag
		})
	);
	public static readonly deleteTag = createAction('[Plugin Marketplace] Delete Tag', (id: ID) => ({ id }));

	// Subscription actions
	public static readonly loadSubscriptionPlans = createAction(
		'[Plugin Marketplace] Load Subscription Plans',
		(pluginId: ID) => ({
			pluginId
		})
	);
	public static readonly subscribe = createAction(
		'[Plugin Marketplace] Subscribe to Plugin',
		(pluginId: ID, planId: ID, paymentMethod: IPaymentMethod) => ({
			pluginId,
			planId,
			paymentMethod
		})
	);
	public static readonly unsubscribe = createAction(
		'[Plugin Marketplace] Unsubscribe from Plugin',
		(pluginId: ID) => ({
			pluginId
		})
	);
	public static readonly updateSubscription = createAction(
		'[Plugin Marketplace] Update Subscription',
		(subscriptionId: ID, updates: Partial<IPluginSubscription>) => ({
			subscriptionId,
			updates
		})
	);

	// Settings actions
	public static readonly loadPluginSettings = createAction(
		'[Plugin Marketplace] Load Plugin Settings',
		(pluginId: ID) => ({
			pluginId
		})
	);
	public static readonly updatePluginSetting = createAction(
		'[Plugin Marketplace] Update Plugin Setting',
		(pluginId: ID, key: string, value: any) => ({
			pluginId,
			key,
			value
		})
	);
	public static readonly resetPluginSettings = createAction(
		'[Plugin Marketplace] Reset Plugin Settings',
		(pluginId: ID) => ({
			pluginId
		})
	);

	// Analytics actions
	public static readonly loadPluginAnalytics = createAction(
		'[Plugin Marketplace] Load Plugin Analytics',
		(pluginId: ID, period?: AnalyticsPeriod) => ({
			pluginId,
			period
		})
	);
	public static readonly trackPluginEvent = createAction(
		'[Plugin Marketplace] Track Plugin Event',
		(pluginId: ID, eventType: string, eventData: any) => ({
			pluginId,
			eventType,
			eventData
		})
	);

	// Security actions
	public static readonly loadPluginSecurity = createAction(
		'[Plugin Marketplace] Load Plugin Security',
		(pluginId: ID) => ({
			pluginId
		})
	);
	public static readonly updatePluginSecurity = createAction(
		'[Plugin Marketplace] Update Plugin Security',
		(pluginId: ID, security: Partial<IPluginSecurity>) => ({
			pluginId,
			security
		})
	);
	public static readonly runSecurityScan = createAction('[Plugin Marketplace] Run Security Scan', (pluginId: ID) => ({
		pluginId
	}));

	// Rating and review actions
	public static readonly ratePlugin = createAction(
		'[Plugin Marketplace] Rate Plugin',
		(pluginId: ID, rating: number, review?: string) => ({
			pluginId,
			rating,
			review
		})
	);
	public static readonly loadPluginReviews = createAction(
		'[Plugin Marketplace] Load Plugin Reviews',
		(pluginId: ID) => ({
			pluginId
		})
	);

	// Category actions
	public static readonly loadCategories = createAction('[Plugin Marketplace] Load Categories');
	public static readonly setSelectedCategory = createAction(
		'[Plugin Marketplace] Set Selected Category',
		(category: string) => ({
			category
		})
	);

	// Featured plugins actions
	public static readonly loadFeaturedPlugins = createAction('[Plugin Marketplace] Load Featured Plugins');
	public static readonly setFeaturedPlugin = createAction(
		'[Plugin Marketplace] Set Featured Plugin',
		(pluginId: ID, featured: boolean) => ({
			pluginId,
			featured
		})
	);

	// Marketplace statistics actions
	public static readonly loadMarketplaceStats = createAction('[Plugin Marketplace] Load Marketplace Stats');
	public static readonly loadMarketplaceTrends = createAction(
		'[Plugin Marketplace] Load Marketplace Trends',
		(category?: string) => ({
			category
		})
	);

	// Notification actions
	public static readonly markNotificationRead = createAction(
		'[Plugin Marketplace] Mark Notification Read',
		(notificationId: ID) => ({
			notificationId
		})
	);
	public static readonly clearAllNotifications = createAction('[Plugin Marketplace] Clear All Notifications');

	// UI state actions
	public static readonly setSelectedPlugin = createAction(
		'[Plugin Marketplace] Set Selected Plugin',
		(plugin: IPlugin | null) => ({
			plugin
		})
	);
	public static readonly togglePluginDetails = createAction(
		'[Plugin Marketplace] Toggle Plugin Details',
		(pluginId: ID) => ({
			pluginId
		})
	);
	public static readonly setLoadingState = createAction(
		'[Plugin Marketplace] Set Loading State',
		(isLoading: boolean) => ({
			isLoading
		})
	);
	public static readonly setError = createAction('[Plugin Marketplace] Set Error', (error: string | null) => ({
		error
	}));

	// Bulk operations
	public static readonly bulkInstallPlugins = createAction(
		'[Plugin Marketplace] Bulk Install Plugins',
		(pluginIds: ID[]) => ({
			pluginIds
		})
	);
	public static readonly bulkUninstallPlugins = createAction(
		'[Plugin Marketplace] Bulk Uninstall Plugins',
		(pluginIds: ID[]) => ({
			pluginIds
		})
	);
	public static readonly bulkUpdatePlugins = createAction(
		'[Plugin Marketplace] Bulk Update Plugins',
		(pluginIds: ID[]) => ({
			pluginIds
		})
	);
}
