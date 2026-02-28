import { PluginActivationController } from './plugin-activation.controller';
import { PluginAnalyticsController } from './plugin-analytics.controller';
import { PluginBillingController } from './plugin-billing.controller';
import { PluginCategoryController } from './plugin-category.controller';
import { PluginInstallationController } from './plugin-installation.controller';
import { PluginManagementController } from './plugin-management.controller';
import { PluginSecurityController } from './plugin-security.controller';
import { PluginSettingController } from './plugin-setting.controller';
import { PluginSourceController } from './plugin-source.controller';
import { PluginSubscriptionAccessController } from './plugin-subscription-access.controller';
import { PluginSubscriptionAnalyticsController } from './plugin-subscription-analytics.controller';
import { PluginSubscriptionPlanController } from './plugin-subscription-plan.controller';
import { PluginSubscriptionController } from './plugin-subscription.controller';
import {
	PluginRecommendationsController,
	PluginTagsController,
	TagPluginsController
} from './plugin-tag-management.controller';
import { PluginTagController } from './plugin-tag.controller';
import { PluginTenantController } from './plugin-tenant.controller';
import {
	PluginUserAssignmentController,
	PluginUserAssignmentManagementController,
	UserPluginAssignmentController
} from './plugin-user-assignment.controller';
import { PluginVersionController } from './plugin-version.controller';
import { PluginController } from './plugin.controller';
import { UserSubscribedPluginsController } from './user-subscribed-plugins.controller';

export const controllers = [
	PluginUserAssignmentController,
	PluginSettingController,
	PluginSubscriptionController,
	PluginSubscriptionAccessController,
	PluginSubscriptionPlanController,
	PluginBillingController,
	PluginTagsController,
	PluginRecommendationsController,
	PluginActivationController,
	PluginInstallationController,
	PluginSourceController,
	PluginVersionController,
	PluginController,
	PluginManagementController,
	PluginSecurityController,
	TagPluginsController,
	PluginTagController,
	PluginCategoryController,
	UserPluginAssignmentController,
	PluginUserAssignmentManagementController,
	PluginAnalyticsController,
	PluginSubscriptionAnalyticsController,
	PluginTenantController,
	UserSubscribedPluginsController
];

export * from './plugin-activation.controller';
export * from './plugin-analytics.controller';
export * from './plugin-billing.controller';
export * from './plugin-category.controller';
export * from './plugin-installation.controller';
export * from './plugin-management.controller';
export * from './plugin-security.controller';
export * from './plugin-setting.controller';
export * from './plugin-source.controller';
export * from './plugin-subscription-access.controller';
export * from './plugin-subscription-analytics.controller';
export * from './plugin-subscription-plan.controller';
export * from './plugin-subscription.controller';
export * from './plugin-tag-management.controller';
export * from './plugin-tag.controller';
export * from './plugin-tenant.controller';
export * from './plugin-user-assignment.controller';
export * from './plugin-version.controller';
export * from './plugin.controller';
export * from './user-subscribed-plugins.controller';
