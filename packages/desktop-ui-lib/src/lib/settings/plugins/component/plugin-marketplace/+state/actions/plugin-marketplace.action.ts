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
	public static upload = createAction('[Plugin Marketplace] Upload', (plugin: IPlugin) => ({ plugin }));
	public static getAll = createAction('[Plugin Marketplace] Get All', <T>(params?: T) => ({ params }));
	public static getOne = createAction('[Plugin Marketplace] Get One', <T>(id: ID, params?: T) => ({ id, params }));
	public static update = createAction('[Plugin Marketplace] Update', (id: ID, plugin: Partial<IPlugin>) => ({
		id,
		plugin
	}));
	public static delete = createAction('[Plugin Marketplace] Delete', (id: ID) => ({ id }));
	public static reset = createAction('[Plugin Marketplace] Reset');

	// Search actions
	public static search = createAction('[Plugin Marketplace] Search', (query: string) => ({ query }));

	// Installation actions
	public static install = createAction('[Plugin Marketplace] Install Plugin', (pluginId: ID, versionId: ID) => ({
		pluginId,
		versionId
	}));

	public static uninstall = createAction(
		'[Plugin Marketplace] Uninstall Plugin',
		(pluginId: ID, installationId: ID, reason?: string) => ({
			installationId,
			pluginId,
			reason
		})
	);

	// Filter actions
	public static setFilters = createAction('[Plugin Marketplace] Set Filters', (filters: IPluginFilter) => ({
		filters
	}));
	public static applyFilters = createAction('[Plugin Marketplace] Apply Filters');
	public static clearFilters = createAction('[Plugin Marketplace] Clear Filters');
	public static toggleAdvancedFilters = createAction(
		'[Plugin Marketplace] Toggle Advanced Filters',
		(show: boolean) => ({ show })
	);
	public static setViewMode = createAction('[Plugin Marketplace] Set View Mode', (view: 'grid' | 'list') => ({
		view
	}));

	// Tags actions
	public static loadTags = createAction('[Plugin Marketplace] Load Tags');
	public static createTag = createAction('[Plugin Marketplace] Create Tag', (tag: IPluginTagCreateInput) => ({
		tag
	}));
	public static updateTag = createAction('[Plugin Marketplace] Update Tag', (id: ID, tag: Partial<IPluginTag>) => ({
		id,
		tag
	}));
	public static deleteTag = createAction('[Plugin Marketplace] Delete Tag', (id: ID) => ({ id }));

	// Subscription actions
	public static loadSubscriptionPlans = createAction(
		'[Plugin Marketplace] Load Subscription Plans',
		(pluginId: ID) => ({
			pluginId
		})
	);
	public static subscribe = createAction(
		'[Plugin Marketplace] Subscribe to Plugin',
		(pluginId: ID, planId: ID, paymentMethod: IPaymentMethod) => ({
			pluginId,
			planId,
			paymentMethod
		})
	);
	public static unsubscribe = createAction('[Plugin Marketplace] Unsubscribe from Plugin', (pluginId: ID) => ({
		pluginId
	}));
	public static updateSubscription = createAction(
		'[Plugin Marketplace] Update Subscription',
		(subscriptionId: ID, updates: Partial<IPluginSubscription>) => ({
			subscriptionId,
			updates
		})
	);

	// Settings actions
	public static loadPluginSettings = createAction('[Plugin Marketplace] Load Plugin Settings', (pluginId: ID) => ({
		pluginId
	}));
	public static updatePluginSetting = createAction(
		'[Plugin Marketplace] Update Plugin Setting',
		(pluginId: ID, key: string, value: any) => ({
			pluginId,
			key,
			value
		})
	);
	public static resetPluginSettings = createAction('[Plugin Marketplace] Reset Plugin Settings', (pluginId: ID) => ({
		pluginId
	}));

	// Analytics actions
	public static loadPluginAnalytics = createAction(
		'[Plugin Marketplace] Load Plugin Analytics',
		(pluginId: ID, period?: AnalyticsPeriod) => ({
			pluginId,
			period
		})
	);
	public static trackPluginEvent = createAction(
		'[Plugin Marketplace] Track Plugin Event',
		(pluginId: ID, eventType: string, eventData: any) => ({
			pluginId,
			eventType,
			eventData
		})
	);

	// Security actions
	public static loadPluginSecurity = createAction('[Plugin Marketplace] Load Plugin Security', (pluginId: ID) => ({
		pluginId
	}));
	public static updatePluginSecurity = createAction(
		'[Plugin Marketplace] Update Plugin Security',
		(pluginId: ID, security: Partial<IPluginSecurity>) => ({
			pluginId,
			security
		})
	);
	public static runSecurityScan = createAction('[Plugin Marketplace] Run Security Scan', (pluginId: ID) => ({
		pluginId
	}));

	// Rating and review actions
	public static ratePlugin = createAction(
		'[Plugin Marketplace] Rate Plugin',
		(pluginId: ID, rating: number, review?: string) => ({
			pluginId,
			rating,
			review
		})
	);
	public static loadPluginReviews = createAction('[Plugin Marketplace] Load Plugin Reviews', (pluginId: ID) => ({
		pluginId
	}));

	// Category actions
	public static loadCategories = createAction('[Plugin Marketplace] Load Categories');
	public static setSelectedCategory = createAction(
		'[Plugin Marketplace] Set Selected Category',
		(category: string) => ({
			category
		})
	);

	// Featured plugins actions
	public static loadFeaturedPlugins = createAction('[Plugin Marketplace] Load Featured Plugins');
	public static setFeaturedPlugin = createAction(
		'[Plugin Marketplace] Set Featured Plugin',
		(pluginId: ID, featured: boolean) => ({
			pluginId,
			featured
		})
	);

	// Marketplace statistics actions
	public static loadMarketplaceStats = createAction('[Plugin Marketplace] Load Marketplace Stats');
	public static loadMarketplaceTrends = createAction(
		'[Plugin Marketplace] Load Marketplace Trends',
		(category?: string) => ({
			category
		})
	);

	// Notification actions
	public static markNotificationRead = createAction(
		'[Plugin Marketplace] Mark Notification Read',
		(notificationId: ID) => ({
			notificationId
		})
	);
	public static clearAllNotifications = createAction('[Plugin Marketplace] Clear All Notifications');

	// UI state actions
	public static setSelectedPlugin = createAction(
		'[Plugin Marketplace] Set Selected Plugin',
		(plugin: IPlugin | null) => ({
			plugin
		})
	);
	public static togglePluginDetails = createAction('[Plugin Marketplace] Toggle Plugin Details', (pluginId: ID) => ({
		pluginId
	}));
	public static setLoadingState = createAction('[Plugin Marketplace] Set Loading State', (isLoading: boolean) => ({
		isLoading
	}));
	public static setError = createAction('[Plugin Marketplace] Set Error', (error: string | null) => ({
		error
	}));

	// Bulk operations
	public static bulkInstallPlugins = createAction('[Plugin Marketplace] Bulk Install Plugins', (pluginIds: ID[]) => ({
		pluginIds
	}));
	public static bulkUninstallPlugins = createAction(
		'[Plugin Marketplace] Bulk Uninstall Plugins',
		(pluginIds: ID[]) => ({
			pluginIds
		})
	);
	public static bulkUpdatePlugins = createAction('[Plugin Marketplace] Bulk Update Plugins', (pluginIds: ID[]) => ({
		pluginIds
	}));
}
