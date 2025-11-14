import { IBasePerTenantAndOrganizationEntityModel, ID, IRole, IUser } from '@gauzy/contracts';
import { PluginScope } from './plugin-scope.model';
import type { IPluginSetting } from './plugin-setting.model';
import type { IPluginSubscription } from './plugin-subscription.model';
import type { IPlugin } from './plugin.model';

/**
 * IPluginTenant Interface
 * Defines the contract for plugin installation and configuration at tenant/organization level
 */
export interface IPluginTenant extends IBasePerTenantAndOrganizationEntityModel {
	/*
	|--------------------------------------------------------------------------
	| Core Properties
	|--------------------------------------------------------------------------
	*/

	/**
	 * Whether the plugin is enabled for this tenant
	 */
	enabled: boolean;

	/**
	 * Scope of the plugin (USER, ORGANIZATION, TENANT)
	 */
	scope: PluginScope;

	/*
	|--------------------------------------------------------------------------
	| Access Control & Permissions
	|--------------------------------------------------------------------------
	*/

	/**
	 * Whether plugin can be installed automatically without user action
	 */
	autoInstall?: boolean;

	/**
	 * Whether plugin requires admin approval before installation
	 */
	requiresApproval?: boolean;

	/**
	 * Whether plugin is mandatory for all users in scope
	 */
	isMandatory?: boolean;

	/*
	|--------------------------------------------------------------------------
	| Usage Limits & Quotas
	|--------------------------------------------------------------------------
	*/

	/**
	 * Maximum number of installations allowed (-1 for unlimited, null for no limit)
	 */
	maxInstallations?: number;

	/**
	 * Maximum number of active users allowed (-1 for unlimited, null for no limit)
	 */
	maxActiveUsers?: number;

	/**
	 * Current number of installations
	 */
	currentInstallations?: number;

	/**
	 * Current number of active users
	 */
	currentActiveUsers?: number;

	/*
	|--------------------------------------------------------------------------
	| Tenant-Specific Configuration
	|--------------------------------------------------------------------------
	*/

	/**
	 * Tenant-specific plugin configuration overrides
	 */
	tenantConfiguration?: Record<string, any>;

	/**
	 * Plugin preferences and UI customizations for this tenant
	 */
	preferences?: Record<string, any>;

	/*
	|--------------------------------------------------------------------------
	| Compliance & Security
	|--------------------------------------------------------------------------
	*/

	/**
	 * Timestamp when the plugin was approved for this tenant
	 */
	approvedAt?: Date;

	/**
	 * ID of the user who approved the plugin for this tenant
	 */
	approvedById?: ID;

	/**
	 * Whether plugin data handling complies with tenant data policies
	 */
	isDataCompliant?: boolean;

	/**
	 * List of compliance certifications applicable to this tenant
	 */
	complianceCertifications?: string[];

	/*
	|--------------------------------------------------------------------------
	| Relationships
	|--------------------------------------------------------------------------
	*/

	/**
	 * Plugin ID
	 */
	pluginId: ID;

	/**
	 * The plugin this configuration applies to
	 */
	plugin?: IPlugin;

	/**
	 * User who approved the plugin for this tenant
	 */
	approvedBy?: IUser;

	/**
	 * Roles explicitly allowed to access this plugin
	 */
	allowedRoles?: IRole[];

	/**
	 * Users explicitly allowed to access this plugin
	 */
	allowedUsers?: IUser[];

	/**
	 * Users explicitly denied access to this plugin
	 */
	deniedUsers?: IUser[];

	/**
	 * Plugin settings specific to this tenant
	 */
	settings?: IPluginSetting[];

	/**
	 * Active subscriptions for this plugin tenant
	 */
	subscriptions?: IPluginSubscription[];

	/*
	|--------------------------------------------------------------------------
	| Virtual Properties
	|--------------------------------------------------------------------------
	*/

	/**
	 * Whether any quota (installations or users) is exceeded
	 */
	isQuotaExceeded?: boolean;

	/**
	 * Whether any limits are configured
	 */
	hasLimits?: boolean;

	/**
	 * Percentage of installation quota used (0-100)
	 */
	installationUtilization?: number;

	/**
	 * Percentage of user quota used (0-100)
	 */
	userUtilization?: number;
}

/**
 * IPluginTenantCreateInput Interface
 * Defines the input structure for creating a new plugin tenant relationship
 */
export interface IPluginTenantCreateInput {
	/**
	 * Plugin to associate with tenant
	 */
	plugin?: IPlugin;

	/**
	 * Plugin ID (if plugin object not provided)
	 */
	pluginId?: ID;

	/**
	 * Tenant ID
	 */
	tenantId?: ID;

	/**
	 * Organization ID
	 */
	organizationId?: ID;

	/**
	 * Scope of the plugin
	 */
	scope?: PluginScope;

	/**
	 * Whether the plugin is enabled
	 */
	enabled?: boolean;

	/**
	 * Whether plugin can be auto-installed
	 */
	autoInstall?: boolean;

	/**
	 * Whether plugin requires approval
	 */
	requiresApproval?: boolean;

	/**
	 * Whether plugin is mandatory
	 */
	isMandatory?: boolean;

	/**
	 * Maximum installations allowed
	 */
	maxInstallations?: number;

	/**
	 * Maximum active users allowed
	 */
	maxActiveUsers?: number;

	/**
	 * Tenant-specific configuration
	 */
	tenantConfiguration?: Record<string, any>;

	/**
	 * Tenant preferences
	 */
	preferences?: Record<string, any>;

	/**
	 * Whether data is compliant
	 */
	isDataCompliant?: boolean;

	/**
	 * Compliance certifications
	 */
	complianceCertifications?: string[];

	/**
	 * Allowed roles
	 */
	allowedRoles?: IRole[];

	/**
	 * Allowed role IDs (if role objects not provided)
	 */
	allowedRoleIds?: ID[];

	/**
	 * Allowed users
	 */
	allowedUsers?: IUser[];

	/**
	 * Allowed user IDs (if user objects not provided)
	 */
	allowedUserIds?: ID[];

	/**
	 * Denied users
	 */
	deniedUsers?: IUser[];

	/**
	 * Denied user IDs (if user objects not provided)
	 */
	deniedUserIds?: ID[];
}

/**
 * IPluginTenantUpdateInput Interface
 * Defines the input structure for updating a plugin tenant relationship
 */
export interface IPluginTenantUpdateInput extends Partial<IPluginTenantCreateInput> {
	/**
	 * ID of the plugin tenant to update
	 */
	id?: ID;
}

/**
 * IPluginTenantFindInput Interface
 * Defines the input structure for finding plugin tenants
 */
export interface IPluginTenantFindInput {
	/**
	 * Plugin ID to filter by
	 */
	pluginId?: ID;

	/**
	 * Tenant ID to filter by
	 */
	tenantId?: ID;

	/**
	 * Organization ID to filter by
	 */
	organizationId?: ID;

	/**
	 * Filter by enabled status
	 */
	enabled?: boolean;

	/**
	 * Filter by scope
	 */
	scope?: PluginScope;

	/**
	 * Filter by mandatory status
	 */
	isMandatory?: boolean;

	/**
	 * Filter by approval status
	 */
	isApproved?: boolean;

	/**
	 * Filter by data compliance status
	 */
	isDataCompliant?: boolean;
}

/**
 * IPluginTenantAccessCheckInput Interface
 * Input for checking user access to a plugin
 */
export interface IPluginTenantAccessCheckInput {
	/**
	 * User ID to check access for
	 */
	userId: ID;

	/**
	 * User roles
	 */
	userRoles: IRole[];

	/**
	 * Plugin ID
	 */
	pluginId: ID;

	/**
	 * Tenant ID
	 */
	tenantId?: ID;

	/**
	 * Organization ID
	 */
	organizationId?: ID;
}

/**
 * IPluginTenantAccessCheckResult Interface
 * Result of access check
 */
export interface IPluginTenantAccessCheckResult {
	/**
	 * Whether user has access
	 */
	hasAccess: boolean;

	/**
	 * Reason for denial if access is denied
	 */
	denialReason?: string;

	/**
	 * Plugin tenant configuration if access is granted
	 */
	pluginTenant?: IPluginTenant;
}

/**
 * IPluginTenantQuotaInfo Interface
 * Quota information for a plugin tenant
 */
export interface IPluginTenantQuotaInfo {
	/**
	 * Maximum installations allowed
	 */
	maxInstallations?: number;

	/**
	 * Current installations
	 */
	currentInstallations: number;

	/**
	 * Whether more installations are allowed
	 */
	canInstallMore: boolean;

	/**
	 * Installation utilization percentage
	 */
	installationUtilization: number;

	/**
	 * Maximum active users allowed
	 */
	maxActiveUsers?: number;

	/**
	 * Current active users
	 */
	currentActiveUsers: number;

	/**
	 * Whether more users can be added
	 */
	canAddMoreUsers: boolean;

	/**
	 * User utilization percentage
	 */
	userUtilization: number;

	/**
	 * Whether any quota is exceeded
	 */
	isQuotaExceeded: boolean;
}

/**
 * IPluginTenantApprovalInput Interface
 * Input for approving a plugin for a tenant
 */
export interface IPluginTenantApprovalInput {
	/**
	 * Plugin tenant ID to approve
	 */
	pluginTenantId: ID;

	/**
	 * User who is approving
	 */
	approvedBy: IUser;

	/**
	 * Approval notes/comments
	 */
	notes?: string;

	/**
	 * Whether to enable the plugin immediately upon approval
	 */
	enableImmediately?: boolean;
}

/**
 * IPluginTenantBulkOperationInput Interface
 * Input for bulk operations on plugin tenants
 */
export interface IPluginTenantBulkOperationInput {
	/**
	 * Plugin tenant IDs to operate on
	 */
	pluginTenantIds: ID[];

	/**
	 * Operation to perform
	 */
	operation: 'enable' | 'disable' | 'approve' | 'revoke' | 'delete';

	/**
	 * User performing the operation
	 */
	performedBy?: IUser;

	/**
	 * Additional data for the operation
	 */
	data?: Record<string, any>;
}

/**
 * IPluginTenantStatistics Interface
 * Statistics for plugin tenant usage
 */
export interface IPluginTenantStatistics {
	/**
	 * Total number of plugin tenants
	 */
	totalPluginTenants: number;

	/**
	 * Number of enabled plugin tenants
	 */
	enabledCount: number;

	/**
	 * Number of disabled plugin tenants
	 */
	disabledCount: number;

	/**
	 * Number of approved plugin tenants
	 */
	approvedCount: number;

	/**
	 * Number of pending approval
	 */
	pendingApprovalCount: number;

	/**
	 * Total installations across all plugin tenants
	 */
	totalInstallations: number;

	/**
	 * Total active users across all plugin tenants
	 */
	totalActiveUsers: number;

	/**
	 * Number of plugin tenants with quota exceeded
	 */
	quotaExceededCount: number;

	/**
	 * Plugin tenants grouped by scope
	 */
	byScope: Record<PluginScope, number>;
}

/**
 * IPluginTenantConfigurationMergeInput Interface
 * Input for merging configurations
 */
export interface IPluginTenantConfigurationMergeInput {
	/**
	 * Plugin tenant ID
	 */
	pluginTenantId: ID;

	/**
	 * Configuration to merge
	 */
	configuration?: Record<string, any>;

	/**
	 * Preferences to merge
	 */
	preferences?: Record<string, any>;

	/**
	 * Whether to replace instead of merge
	 */
	replace?: boolean;
}
