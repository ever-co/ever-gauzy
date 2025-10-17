import { PluginActivationController } from './plugin-activation.controller';
import { PluginInstallationController } from './plugin-installation.controller';
import { PluginManagementController } from './plugin-management.controller';
import { PluginSecurityController } from './plugin-security.controller';
import { PluginSourceController } from './plugin-source.controller';
import { PluginVersionController } from './plugin-version.controller';
import { PluginController } from './plugin.controller';
import { PluginSettingController } from './plugin-setting.controller';
import { PluginSubscriptionController } from './plugin-subscription.controller';
import { PluginCategoryController } from './plugin-category.controller';

export const controllers = [
	PluginManagementController,
	PluginActivationController,
	PluginInstallationController,
	PluginSecurityController,
	PluginVersionController,
	PluginSourceController,
	PluginController,
	PluginSettingController,
	PluginSubscriptionController,
	PluginCategoryController
];

// Export individual controllers
export * from './plugin-activation.controller';
export * from './plugin-installation.controller';
export * from './plugin-management.controller';
export * from './plugin-security.controller';
export * from './plugin-source.controller';
export * from './plugin-version.controller';
export * from './plugin.controller';
export * from './plugin-setting.controller';
export * from './plugin-subscription.controller';
export * from './plugin-category.controller';
