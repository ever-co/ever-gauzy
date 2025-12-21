import { ID, IRole, IUser, PluginScope, IPluginTenant as PluginTenantModel } from '@gauzy/contracts';
import type { IPlugin } from './plugin.model';

/**
 * IPluginTenant Interface
 * Defines the contract for plugin installation and configuration at tenant/organization level
 */
export interface IPluginTenant extends PluginTenantModel {
	/*
	|--------------------------------------------------------------------------
	| Business Logic Methods - Availability & Access Control
	|--------------------------------------------------------------------------
	*/

	/**
	 * Check if plugin is available for use in this tenant
	 * @returns true if plugin is enabled
	 */
	isAvailable?(): boolean;

	/**
	 * Check if user has access to this plugin based on roles and explicit permissions
	 * @param userId - User ID to check
	 * @param userRoles - Array of roles the user has
	 * @returns true if user has access
	 */
	hasUserAccess?(userId: string, userRoles: IRole[]): boolean;

	/**
	 * Check if tenant can install more instances based on quota
	 * @returns true if more installations are allowed
	 */
	canInstallMore?(): boolean;

	/**
	 * Check if tenant can add more active users based on quota
	 * @returns true if more users can be added
	 */
	canAddMoreUsers?(): boolean;

	/**
	 * Check if plugin is mandatory for users in this tenant
	 * @returns true if plugin is mandatory and available
	 */
	isMandatoryForTenant?(): boolean;

	/**
	 * Check if plugin requires approval for installation
	 * @returns true if approval is required
	 */
	needsApprovalForInstallation?(): boolean;

	/**
	 * Check if plugin can be auto-installed
	 * @returns true if auto-install is enabled and requirements are met
	 */
	canAutoInstall?(): boolean;

	/*
	|--------------------------------------------------------------------------
	| Configuration Management Methods
	|--------------------------------------------------------------------------
	*/

	/**
	 * Get effective configuration for this plugin tenant
	 * @returns Merged configuration object
	 */
	getEffectiveConfiguration?(): Record<string, any>;

	/**
	 * Update tenant-specific configuration (merges with existing)
	 * @param config - Configuration object to merge
	 */
	updateConfiguration?(config: Record<string, any>): void;

	/**
	 * Replace entire tenant configuration
	 * @param config - New configuration object
	 */
	setConfiguration?(config: Record<string, any>): void;

	/**
	 * Update tenant preferences (merges with existing)
	 * @param prefs - Preferences object to merge
	 */
	updatePreferences?(prefs: Record<string, any>): void;

	/**
	 * Replace entire preferences
	 * @param prefs - New preferences object
	 */
	setPreferences?(prefs: Record<string, any>): void;

	/*
	|--------------------------------------------------------------------------
	| Usage Tracking Methods
	|--------------------------------------------------------------------------
	*/

	/**
	 * Increment installation count
	 * @throws Error if quota would be exceeded
	 */
	incrementInstallations?(): void;

	/**
	 * Decrement installation count (safely prevents negative values)
	 */
	decrementInstallations?(): void;

	/**
	 * Increment active user count
	 * @throws Error if quota would be exceeded
	 */
	incrementActiveUsers?(): void;

	/**
	 * Decrement active user count (safely prevents negative values)
	 */
	decrementActiveUsers?(): void;

	/**
	 * Reset usage counters to zero
	 */
	resetUsageCounters?(): void;

	/*
	|--------------------------------------------------------------------------
	| State Management Methods
	|--------------------------------------------------------------------------
	*/

	/**
	 * Enable plugin for tenant
	 */
	enable?(): void;

	/**
	 * Disable plugin for tenant
	 */
	disable?(): void;

	/**
	 * Archive plugin tenant configuration
	 */
	archive?(): void;

	/**
	 * Reinstate archived plugin tenant configuration
	 * @throws Error if not archived
	 */
	restore?(): void;

	/**
	 * Toggle plugin enabled state
	 * @returns New enabled state
	 */
	toggleEnabled?(): boolean;

	/**
	 * Approve plugin for tenant
	 * @param approvedBy - User who approved the plugin
	 */
	approve?(approvedBy: IUser): void;

	/**
	 * Revoke approval for plugin
	 */
	revokeApproval?(): void;

	/**
	 * Check if plugin is approved
	 * @returns true if plugin has been approved
	 */
	isApproved?(): boolean;

	/*
	|--------------------------------------------------------------------------
	| Access Control Management Methods - Users
	|--------------------------------------------------------------------------
	*/

	/**
	 * Add user to allowed list
	 * @param user - User to allow
	 */
	allowUser?(user: IUser): void;

	/**
	 * Remove user from allowed list
	 * @param userId - ID of user to remove from allowed list
	 */
	removeAllowedUser?(userId: string): void;

	/**
	 * Add user to denied list
	 * @param user - User to deny
	 */
	denyUser?(user: IUser): void;

	/**
	 * Remove user from denied list
	 * @param userId - ID of user to remove from denied list
	 */
	removeDeniedUser?(userId: string): void;

	/**
	 * Clear all user-specific access controls
	 */
	clearUserAccessControls?(): void;

	/*
	|--------------------------------------------------------------------------
	| Access Control Management Methods - Roles
	|--------------------------------------------------------------------------
	*/

	/**
	 * Add role to allowed list
	 * @param role - Role to allow
	 */
	allowRole?(role: IRole): void;

	/**
	 * Remove role from allowed list
	 * @param roleId - ID of role to remove
	 */
	removeAllowedRole?(roleId: string): void;

	/**
	 * Clear all role-based access controls
	 */
	clearRoleAccessControls?(): void;

	/**
	 * Clear all access controls (both users and roles)
	 */
	clearAllAccessControls?(): void;
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
