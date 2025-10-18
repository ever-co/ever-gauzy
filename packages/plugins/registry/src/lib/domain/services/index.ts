import { PluginInstallationService } from './plugin-installation.service';
import { PluginSecurityService } from './plugin-security.service';
import { PluginSourceService } from './plugin-source.service';
import { PluginVersionService } from './plugin-version.service';
import { PluginService } from './plugin.service';
import { PluginSettingService } from './plugin-setting.service';
import { PluginSubscriptionService } from './plugin-subscription.service';
import { PluginBillingService } from './plugin-billing.service';
import { PluginCategoryService } from './plugin-category.service';

export const services = [
	PluginService,
	PluginInstallationService,
	PluginSourceService,
	PluginVersionService,
	PluginSecurityService,
	PluginSettingService,
	PluginSubscriptionService,
	PluginBillingService,
	PluginCategoryService
];

// Export individual services
export * from './plugin-installation.service';
export * from './plugin-security.service';
export * from './plugin-source.service';
export * from './plugin-version.service';
export * from './plugin.service';
export * from './plugin-setting.service';
export * from './plugin-subscription.service';
export * from './plugin-billing.service';
export * from './plugin-category.service';
