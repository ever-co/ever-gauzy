import { PluginBilling } from './plugin-billing.entity';
import { PluginCategory } from './plugin-category.entity';
import { PluginInstallation } from './plugin-installation.entity';
import { PluginSetting } from './plugin-setting.entity';
import { PluginSource } from './plugin-source.entity';
import { PluginSubscriptionPlan } from './plugin-subscription-plan.entity';
import { PluginSubscription } from './plugin-subscription.entity';
import { PluginTag } from './plugin-tag.entity';
import { PluginTenant } from './plugin-tenant.entity';
import { PluginVersion } from './plugin-version.entity';
import { Plugin } from './plugin.entity';

export const entities = [
	PluginInstallation,
	PluginSource,
	PluginTag,
	PluginTenant,
	PluginVersion,
	Plugin,
	PluginSetting,
	PluginSubscription,
	PluginBilling,
	PluginCategory,
	PluginSubscriptionPlan
];

export * from './plugin-billing.entity';
export * from './plugin-category.entity';
export * from './plugin-installation.entity';
export * from './plugin-setting.entity';
export * from './plugin-source.entity';
export * from './plugin-subscription-plan.entity';
export * from './plugin-subscription.entity';
export * from './plugin-tag.entity';
export * from './plugin-tenant.entity';
export * from './plugin-version.entity';
export * from './plugin.entity';
