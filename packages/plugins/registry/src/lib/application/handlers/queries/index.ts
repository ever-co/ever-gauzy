// Plugin Management Query Handlers
export * from './get-plugin-query.handler';
export * from './list-plugin-versions-query.handler';
export * from './list-plugins-query.handler';
export * from './list-plugins-sources-query.handler';
export * from './search-plugins-query.handler';

// Plugin User Assignment Query Handlers
export * from './plugin-user-assignment-query.handlers';

// Plugin Category Query Handlers
export * from './get-plugin-categories.handler';
export * from './get-plugin-category-tree.handler';
export * from './get-plugin-category.handler';

// Plugin Subscription Query Handlers
export * from './check-plugin-access.handler';
export * from './get-active-plugin-subscription.handler';
export * from './get-expiring-subscriptions.handler';
export * from './get-plugin-subscription-by-id.handler';
export * from './get-plugin-subscriptions-by-plugin-id.handler';
export * from './get-plugin-subscriptions-by-subscriber-id.handler';
export * from './get-plugin-subscriptions.handler';

// Plugin Subscription Plan Query Handlers
export * from './get-active-plugin-plans.handler';
export * from './get-plugin-plan-analytics.handler';
export * from './get-plugin-subscription-plan-by-id.handler';
export * from './get-plugin-subscription-plans-by-plugin-id.handler';
export * from './list-plugin-subscription-plans.handler';

// Plugin Settings Query Handlers
export * from './get-plugin-setting-by-id.handler';
export * from './get-plugin-setting-by-key.handler';
export * from './get-plugin-setting-value.handler';
export * from './get-plugin-settings-by-category.handler';
export * from './get-plugin-settings-by-plugin-id.handler';
export * from './get-plugin-settings-by-tenant-id.handler';
export * from './get-plugin-settings.handler';

// Import all handlers for array export
import { CheckPluginAccessQueryHandler } from './check-plugin-access.handler';
import { GetActivePluginPlansQueryHandler } from './get-active-plugin-plans.handler';
import { GetActivePluginSubscriptionQueryHandler } from './get-active-plugin-subscription.handler';
import { GetExpiringSubscriptionsQueryHandler } from './get-expiring-subscriptions.handler';
import { GetPluginCategoriesHandler } from './get-plugin-categories.handler';
import { GetPluginCategoryTreeHandler } from './get-plugin-category-tree.handler';
import { GetPluginCategoryHandler } from './get-plugin-category.handler';
import { GetPluginPlanAnalyticsQueryHandler } from './get-plugin-plan-analytics.handler';
import { GetPluginQueryHandler } from './get-plugin-query.handler';
import { GetPluginSettingByIdHandler } from './get-plugin-setting-by-id.handler';
import { GetPluginSettingByKeyHandler } from './get-plugin-setting-by-key.handler';
import { GetPluginSettingValueHandler } from './get-plugin-setting-value.handler';
import { GetPluginSettingsByCategoryHandler } from './get-plugin-settings-by-category.handler';
import { GetPluginSettingsByPluginIdHandler } from './get-plugin-settings-by-plugin-id.handler';
import { GetPluginSettingsByTenantIdHandler } from './get-plugin-settings-by-tenant-id.handler';
import { GetPluginSettingsHandler } from './get-plugin-settings.handler';
import { GetPluginSubscriptionByIdQueryHandler } from './get-plugin-subscription-by-id.handler';
import { GetPluginSubscriptionPlanByIdQueryHandler } from './get-plugin-subscription-plan-by-id.handler';
import { GetPluginSubscriptionPlansByPluginIdQueryHandler } from './get-plugin-subscription-plans-by-plugin-id.handler';
import { GetPluginSubscriptionsByPluginIdQueryHandler } from './get-plugin-subscriptions-by-plugin-id.handler';
import { GetPluginSubscriptionsBySubscriberIdQueryHandler } from './get-plugin-subscriptions-by-subscriber-id.handler';
import { GetPluginSubscriptionsQueryHandler } from './get-plugin-subscriptions.handler';
import { ListPluginSubscriptionPlansQueryHandler } from './list-plugin-subscription-plans.handler';
import { ListPluginVersionsQueryHandler } from './list-plugin-versions-query.handler';
import { ListPluginsQueryHandler } from './list-plugins-query.handler';
import { ListPluginSourcesQueryHandler } from './list-plugins-sources-query.handler';
import {
	CheckUserPluginAccessQueryHandler,
	GetAllPluginUserAssignmentsQueryHandler,
	GetPluginUserAssignmentsQueryHandler,
	GetUserPluginAssignmentsQueryHandler
} from './plugin-user-assignment-query.handlers';
import { SearchPluginsQueryHandler } from './search-plugins-query.handler';

export const queries = [
	GetPluginQueryHandler,
	ListPluginsQueryHandler,
	ListPluginVersionsQueryHandler,
	ListPluginSourcesQueryHandler,
	SearchPluginsQueryHandler,
	GetPluginCategoriesHandler,
	GetPluginCategoryHandler,
	GetPluginCategoryTreeHandler,
	GetPluginSubscriptionsQueryHandler,
	GetPluginSubscriptionByIdQueryHandler,
	GetPluginSubscriptionsByPluginIdQueryHandler,
	GetPluginSubscriptionsBySubscriberIdQueryHandler,
	GetActivePluginSubscriptionQueryHandler,
	CheckPluginAccessQueryHandler,
	GetExpiringSubscriptionsQueryHandler,
	// Plugin Subscription Plan Query Handlers
	GetActivePluginPlansQueryHandler,
	GetPluginPlanAnalyticsQueryHandler,
	GetPluginSubscriptionPlanByIdQueryHandler,
	GetPluginSubscriptionPlansByPluginIdQueryHandler,
	ListPluginSubscriptionPlansQueryHandler,
	// Plugin Settings Query Handlers
	GetPluginSettingsHandler,
	GetPluginSettingByIdHandler,
	GetPluginSettingsByPluginIdHandler,
	GetPluginSettingsByTenantIdHandler,
	GetPluginSettingByKeyHandler,
	GetPluginSettingsByCategoryHandler,
	GetPluginSettingValueHandler,
	// Plugin User Assignment Query Handlers
	GetPluginUserAssignmentsQueryHandler,
	GetUserPluginAssignmentsQueryHandler,
	CheckUserPluginAccessQueryHandler,
	GetAllPluginUserAssignmentsQueryHandler
];
