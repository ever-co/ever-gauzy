import { PluginBillingService } from './plugin-billing.service';
import { PluginCategoryService } from './plugin-category.service';
import { PluginInstallationService } from './plugin-installation.service';
import { PluginSecurityService } from './plugin-security.service';
import { PluginSettingService } from './plugin-setting.service';
import { PluginSourceService } from './plugin-source.service';
import { PluginSubscriptionAccessService } from './plugin-subscription-access.service';
import { PluginSubscriptionPlanService } from './plugin-subscription-plan.service';
import { PluginSubscriptionService } from './plugin-subscription.service';
import { PluginTagService } from './plugin-tag.service';
import { PluginTenantService } from './plugin-tenant.service';
import { PluginUserAssignmentService } from './plugin-user-assignment.service';
import { PluginVersionService } from './plugin-version.service';
import { PluginService } from './plugin.service';

export const services = [
	PluginService,
	PluginInstallationService,
	PluginSourceService,
	PluginTagService,
	PluginVersionService,
	PluginSecurityService,
	PluginSettingService,
	PluginTenantService,
	PluginSubscriptionService,
	PluginSubscriptionAccessService,
	PluginSubscriptionPlanService,
	PluginBillingService,
	PluginCategoryService,
	PluginUserAssignmentService
];

// Export individual services
export * from './plugin-billing.service';
export * from './plugin-category.service';
export * from './plugin-installation.service';
export * from './plugin-security.service';
export * from './plugin-setting.service';
export * from './plugin-source.service';
export * from './plugin-subscription-access.service';
export * from './plugin-subscription-plan.service';
export * from './plugin-subscription.service';
export * from './plugin-tag.service';
export * from './plugin-tenant.service';
export * from './plugin-user-assignment.service';
export * from './plugin-version.service';
export * from './plugin.service';
