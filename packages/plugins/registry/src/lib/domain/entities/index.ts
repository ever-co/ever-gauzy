import { PluginInstallation } from './plugin-installation.entity';
import { PluginSource } from './plugin-source.entity';
import { PluginTenant } from './plugin-tenant.entity';
import { PluginVersion } from './plugin-version.entity';
import { Plugin } from './plugin.entity';
import { PluginSetting } from './plugin-setting.entity';
import { PluginSubscription } from './plugin-subscription.entity';
import { PluginCategory } from './plugin-category.entity';

export const entities = [
	PluginInstallation,
	PluginSource,
	PluginTenant,
	PluginVersion,
	Plugin,
	PluginSetting,
	PluginSubscription,
	PluginCategory
];

// Export individual entities
export * from './plugin-installation.entity';
export * from './plugin-source.entity';
export * from './plugin-tenant.entity';
export * from './plugin-version.entity';
export * from './plugin.entity';
export * from './plugin-setting.entity';
export * from './plugin-subscription.entity';
export * from './plugin-category.entity';
