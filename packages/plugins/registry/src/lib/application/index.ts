// Application Layer - Domain-Based Organization
// Each domain encapsulates related commands, queries, and handlers

import {
	CreatePluginCommandHandler,
	DeletePluginCommandHandler,
	UpdatePluginCommandHandler,
	VerifyPluginCommandHandler
} from './plugin';
import {
	PluginBillingCreateHandler,
	PluginBillingProcessPaymentHandler,
	ProcessBillingCommandHandler
} from './plugin-billing';
import {
	CreatePluginCategoryHandler,
	DeletePluginCategoryHandler,
	UpdatePluginCategoryHandler
} from './plugin-category/commands/handlers';
import {
	GetPluginCategoriesHandler,
	GetPluginCategoryHandler,
	GetPluginCategoryTreeHandler
} from './plugin-category/queries/handlers';
import {
	ActivatePluginCommandHandler,
	DeactivatePluginCommandHandler,
	InstallPluginCommandHandler,
	UninstallPluginCommandHandler
} from './plugin-installation';
import {
	BulkUpdatePluginSettingsHandler,
	CreatePluginSettingHandler,
	DeletePluginSettingHandler,
	GetPluginSettingByIdHandler,
	GetPluginSettingByKeyHandler,
	GetPluginSettingsByCategoryHandler,
	GetPluginSettingsByPluginIdHandler,
	GetPluginSettingsByTenantIdHandler,
	GetPluginSettingsHandler,
	GetPluginSettingValueHandler,
	PluginConfigGetHandler,
	PluginConfigSetHandler,
	SetPluginSettingValueHandler,
	UpdatePluginSettingHandler
} from './plugin-setting';

import { ListPluginSourcesQueryHandler } from './plugin-source';
import {
	CreatePluginSourceCommandHandler,
	DeletePluginSourceCommandHandler,
	RecoverPluginSourceCommandHandler
} from './plugin-source/commands/handlers';
import {
	BulkCreatePluginPlansHandler,
	BulkPluginPlanOperationCommandHandler,
	CancelPluginSubscriptionCommandHandler,
	CheckUserSubscriptionAccessQueryHandler,
	CopyPluginPlanCommandHandler,
	CreatePluginSubscriptionCommandHandler,
	CreatePluginSubscriptionPlanCommandHandler,
	DeletePluginSubscriptionCommandHandler,
	DeletePluginSubscriptionPlanCommandHandler,
	DowngradePluginSubscriptionCommandHandler,
	ExtendTrialSubscriptionCommandHandler,
	GetActivePluginPlansQueryHandler,
	GetActivePluginSubscriptionQueryHandler,
	GetExpiringSubscriptionsQueryHandler,
	GetPluginPlanAnalyticsQueryHandler,
	GetPluginSubscriptionByIdQueryHandler,
	GetPluginSubscriptionPlanByIdQueryHandler,
	GetPluginSubscriptionPlansByPluginIdQueryHandler,
	GetPluginSubscriptionsByPluginIdQueryHandler,
	GetPluginSubscriptionsBySubscriberIdQueryHandler,
	GetPluginSubscriptionsQueryHandler,
	GetSubscriptionAccessQueryHandler,
	GetUserSubscribedPluginsQueryHandler,
	ListPluginSubscriptionPlansQueryHandler,
	PurchasePluginSubscriptionCommandHandler,
	RenewPluginSubscriptionCommandHandler,
	UpdatePluginSubscriptionCommandHandler,
	UpdatePluginSubscriptionPlanCommandHandler,
	UpgradePluginSubscriptionCommandHandler
} from './plugin-subscription';
import {
	AutoTagPluginHandler,
	BulkCreatePluginTagsHandler,
	BulkDeletePluginTagsHandler,
	BulkUpdatePluginTagsHandler,
	CreatePluginTagHandler,
	DeletePluginTagHandler,
	ReplacePluginTagsHandler,
	UpdatePluginTagHandler,
	UpdatePluginTagsPriorityHandler
} from './plugin-tag/commands/handlers';
import {
	ApprovePluginTenantCommandHandler,
	BulkUpdatePluginTenantCommandHandler,
	CreatePluginTenantCommandHandler,
	DeletePluginTenantCommandHandler,
	DisablePluginTenantCommandHandler,
	EnablePluginTenantCommandHandler,
	ManagePluginTenantUsersCommandHandler,
	UpdatePluginTenantCommandHandler,
	UpdatePluginTenantConfigurationCommandHandler
} from './plugin-tenant/commands/handlers';
import {
	CheckPluginTenantAccessHandler,
	GetAllPluginTenantsHandler,
	GetPluginTenantByIdHandler,
	GetPluginTenantByPluginHandler,
	GetPluginTenantQuotaInfoHandler,
	GetPluginTenantsByPluginHandler,
	GetPluginTenantsByTenantHandler,
	GetPluginTenantStatisticsHandler,
	GetPluginTenantUsersHandler
} from './plugin-tenant/queries/handlers';
import {
	AssignPluginSubscriptionUsersCommandHandler,
	AssignUsersToPluginCommandHandler,
	BulkAssignUsersToPluginsCommandHandler,
	CheckUserPluginAccessQueryHandler,
	GetAllPluginUserAssignmentsQueryHandler,
	GetPluginUserAssignmentsQueryHandler,
	GetUserPluginAssignmentsQueryHandler,
	RevokePluginSubscriptionUsersCommandHandler,
	UnassignUsersFromPluginCommandHandler
} from './plugin-user-assignment';
import {
	CreatePluginVersionCommandHandler,
	DeletePluginVersionCommandHandler,
	ListPluginVersionsQueryHandler,
	RecoverPluginVersionCommandHandler,
	UpdatePluginVersionCommandHandler
} from './plugin-version';
import {
	CheckPluginAccessQueryHandler,
	GetPluginQueryHandler,
	ListPluginsQueryHandler,
	SearchPluginsQueryHandler
} from './plugin/queries/handlers';

// Export commands handlers array
const commands = [
	// Plugin Management Command Handlers
	ActivatePluginCommandHandler,
	CreatePluginCommandHandler,
	DeactivatePluginCommandHandler,
	DeletePluginCommandHandler,
	InstallPluginCommandHandler,
	UninstallPluginCommandHandler,
	UpdatePluginCommandHandler,
	VerifyPluginCommandHandler,

	// Plugin User Assignment Command Handlers
	AssignUsersToPluginCommandHandler,
	UnassignUsersFromPluginCommandHandler,
	BulkAssignUsersToPluginsCommandHandler,

	// Plugin Version Command Handlers
	CreatePluginVersionCommandHandler,
	DeletePluginVersionCommandHandler,
	RecoverPluginVersionCommandHandler,
	UpdatePluginVersionCommandHandler,

	// Plugin Source Command Handlers
	CreatePluginSourceCommandHandler,
	DeletePluginSourceCommandHandler,
	RecoverPluginSourceCommandHandler,

	// Plugin Category Command Handlers
	CreatePluginCategoryHandler,
	DeletePluginCategoryHandler,
	UpdatePluginCategoryHandler,

	// Plugin Subscription Command Handlers
	AssignPluginSubscriptionUsersCommandHandler,
	CancelPluginSubscriptionCommandHandler,
	CreatePluginSubscriptionCommandHandler,
	DeletePluginSubscriptionCommandHandler,
	DowngradePluginSubscriptionCommandHandler,
	ExtendTrialSubscriptionCommandHandler,
	PluginBillingCreateHandler,
	PluginBillingProcessPaymentHandler,
	ProcessBillingCommandHandler,
	PurchasePluginSubscriptionCommandHandler,
	RenewPluginSubscriptionCommandHandler,
	RevokePluginSubscriptionUsersCommandHandler,
	UpdatePluginSubscriptionCommandHandler,
	UpgradePluginSubscriptionCommandHandler,

	// Plugin Subscription Plan Command Handlers
	BulkPluginPlanOperationCommandHandler,
	BulkCreatePluginPlansHandler,
	CopyPluginPlanCommandHandler,
	CreatePluginSubscriptionPlanCommandHandler,
	DeletePluginSubscriptionPlanCommandHandler,
	UpdatePluginSubscriptionPlanCommandHandler,

	// Plugin Settings Command Handlers
	BulkUpdatePluginSettingsHandler,
	CreatePluginSettingHandler,
	DeletePluginSettingHandler,
	SetPluginSettingValueHandler,
	UpdatePluginSettingHandler,

	// Plugin Configuration Command Handlers
	PluginConfigGetHandler,
	PluginConfigSetHandler,

	// Plugin Tag Command Handlers
	AutoTagPluginHandler,
	BulkCreatePluginTagsHandler,
	BulkDeletePluginTagsHandler,
	BulkUpdatePluginTagsHandler,
	CreatePluginTagHandler,
	DeletePluginTagHandler,
	ReplacePluginTagsHandler,
	UpdatePluginTagHandler,
	UpdatePluginTagsPriorityHandler,

	// Plugin Tenant Command Handlers
	ApprovePluginTenantCommandHandler,
	BulkUpdatePluginTenantCommandHandler,
	CreatePluginTenantCommandHandler,
	DeletePluginTenantCommandHandler,
	DisablePluginTenantCommandHandler,
	EnablePluginTenantCommandHandler,
	ManagePluginTenantUsersCommandHandler,
	UpdatePluginTenantCommandHandler,
	UpdatePluginTenantConfigurationCommandHandler
];

const queries = [
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
	GetUserSubscribedPluginsQueryHandler,
	CheckPluginAccessQueryHandler,
	CheckUserSubscriptionAccessQueryHandler,
	GetSubscriptionAccessQueryHandler,
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
	GetAllPluginUserAssignmentsQueryHandler,

	// Plugin Tenant Query Handlers
	CheckPluginTenantAccessHandler,
	GetAllPluginTenantsHandler,
	GetPluginTenantByIdHandler,
	GetPluginTenantByPluginHandler,
	GetPluginTenantQuotaInfoHandler,
	GetPluginTenantStatisticsHandler,
	GetPluginTenantsByPluginHandler,
	GetPluginTenantsByTenantHandler,
	GetPluginTenantUsersHandler
];

export const handlers = [...commands, ...queries];

// Core Plugin Management
export * from './plugin';

// Plugin Categorization
export * from './plugin-category';

// Plugin Configuration & Settings
export * from './plugin-setting';

// Plugin Subscriptions & Plans
export * from './plugin-subscription';

// Plugin Source Code Management
export * from './plugin-source';

// Plugin Version Management
export * from './plugin-version';

// Plugin Tagging System
export * from './plugin-tag';

// Plugin Billing & Payments
export * from './plugin-billing';

// Plugin User Access Management
export * from './plugin-user-assignment';

// Plugin Tenant Management
export * from './plugin-tenant';

// exports for backward compatibility
export * from './strategies';

// export for installations
export * from './plugin-installation';
