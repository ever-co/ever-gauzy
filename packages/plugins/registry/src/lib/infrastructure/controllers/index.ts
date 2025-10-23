import { PluginActivationController } from './plugin-activation.controller';
import { PluginAnalyticsController } from './plugin-analytics.controller';
import { PluginBillingController } from './plugin-billing.controller';
import { PluginCategoryController } from './plugin-category.controller';
import { PluginInstallationController } from './plugin-installation.controller';
import { PluginManagementController } from './plugin-management.controller';
import { PluginSecurityController } from './plugin-security.controller';
import { PluginSettingController } from './plugin-setting.controller';
import { PluginSourceController } from './plugin-source.controller';
import { PluginSubscriptionAnalyticsController } from './plugin-subscription-analytics.controller';
import { PluginSubscriptionController } from './plugin-subscription.controller';
import {
	PluginRecommendationsController,
	PluginTagsController,
	TagPluginsController
} from './plugin-tag-management.controller';
import { PluginTagController } from './plugin-tag.controller';
import {
	PluginUserAssignmentController,
	PluginUserAssignmentManagementController,
	UserPluginAssignmentController
} from './plugin-user-assignment.controller';
import { PluginVersionController } from './plugin-version.controller';
import { PluginController } from './plugin.controller';

export const controllers = [
	PluginManagementController,
	PluginActivationController,
	PluginInstallationController,
	PluginSecurityController,
	PluginTagsController,
	PluginRecommendationsController,
	TagPluginsController,
	PluginTagController,
	PluginVersionController,
	PluginSourceController,
	PluginController,
	PluginSettingController,
	PluginSubscriptionController,
	PluginBillingController,
	PluginCategoryController,
	PluginUserAssignmentController,
	UserPluginAssignmentController,
	PluginUserAssignmentManagementController,
	PluginAnalyticsController,
	PluginSubscriptionAnalyticsController
];
