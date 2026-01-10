import { isBetterSqlite3, isMySQL, isPostgres } from '@gauzy/config';
import { ID, IRole, IUser, PluginScope } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany,
	Role,
	TenantOrganizationBaseEntity,
	User,
	VirtualMultiOrmColumn
} from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';
import { Index, JoinTable, Relation, RelationId } from 'typeorm';
import { IPlugin, IPluginSetting, IPluginSubscription, IPluginTenant } from '../../shared';
import { PluginSetting } from './plugin-setting.entity';
import { PluginSubscription } from './plugin-subscription.entity';
import { Plugin } from './plugin.entity';

/**
 * PluginTenant Entity
 * Manages plugin installation and configuration at the tenant/organization level
 * Handles access control, usage limits, and tenant-specific customizations
 */
@Index(['pluginId', 'tenantId', 'organizationId'], { unique: true })
@Index(['tenantId', 'scope', 'enabled'])
@Index(['organizationId', 'scope'])
@Index(['pluginId', 'enabled'])
@MultiORMEntity('plugin_tenants')
export class PluginTenant extends TenantOrganizationBaseEntity implements IPluginTenant {
	/*
	|--------------------------------------------------------------------------
	| @ApiProperty Properties
	|--------------------------------------------------------------------------
	*/

	@ApiProperty({ type: () => String, description: 'Plugin ID' })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: PluginTenant) => it.plugin)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true, type: 'uuid' })
	pluginId: ID;

	@ApiProperty({ type: Boolean, description: 'Whether the plugin is enabled for this tenant' })
	@IsNotEmpty()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ type: 'boolean', default: true })
	enabled: boolean;

	@ApiProperty({ enum: PluginScope, description: 'Scope of the plugin (USER, ORGANIZATION, TENANT)' })
	@IsNotEmpty()
	@IsEnum(PluginScope)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: PluginScope, default: PluginScope.USER })
	scope: PluginScope;

	/*
	|--------------------------------------------------------------------------
	| @ApiPropertyOptional Properties
	|--------------------------------------------------------------------------
	*/

	/**
	 * Access Control & Permissions
	 */
	@ApiPropertyOptional({
		type: Boolean,
		description: 'Whether plugin can be installed automatically without user action',
		default: false
	})
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	autoInstall?: boolean;

	@ApiPropertyOptional({
		type: Boolean,
		description: 'Whether plugin requires admin approval before installation',
		default: true
	})
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	requiresApproval?: boolean;

	@ApiPropertyOptional({
		type: Boolean,
		description: 'Whether plugin is mandatory for all users in scope',
		default: false
	})
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isMandatory?: boolean;

	/**
	 * Usage Limits & Quotas
	 */
	@ApiPropertyOptional({
		type: Number,
		description: 'Maximum number of installations allowed (-1 for unlimited, null for no limit)',
		example: 100
	})
	@IsOptional()
	@ValidateIf((o) => o.maxInstallations !== null && o.maxInstallations !== undefined)
	@IsInt()
	@Min(-1)
	@MultiORMColumn({ type: 'int', nullable: true })
	maxInstallations?: number;

	@ApiPropertyOptional({
		type: Number,
		description: 'Maximum number of active users allowed (-1 for unlimited, null for no limit)',
		example: 50
	})
	@IsOptional()
	@ValidateIf((o) => o.maxActiveUsers !== null && o.maxActiveUsers !== undefined)
	@IsInt()
	@Min(-1)
	@MultiORMColumn({ type: 'int', nullable: true })
	maxActiveUsers?: number;

	@ApiPropertyOptional({
		type: Number,
		description: 'Current number of installations',
		example: 25,
		default: 0
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	@ColumnIndex()
	@MultiORMColumn({ type: 'int', default: 0 })
	currentInstallations?: number;

	@ApiPropertyOptional({
		type: Number,
		description: 'Current number of active users',
		example: 15,
		default: 0
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	@ColumnIndex()
	@MultiORMColumn({ type: 'int', default: 0 })
	currentActiveUsers?: number;

	/**
	 * Tenant-Specific Configuration
	 */
	@ApiPropertyOptional({
		type: () => Object,
		description: 'Tenant-specific plugin configuration overrides',
		example: {
			branding: { logo: 'tenant-logo.png', theme: 'blue' },
			features: { advancedReporting: true },
			limits: { dailyUsage: 1000 }
		}
	})
	@IsOptional()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	tenantConfiguration?: Record<string, any>;

	@ApiPropertyOptional({
		type: () => Object,
		description: 'Plugin preferences and UI customizations for this tenant',
		example: {
			defaultSettings: { autoSave: true, notifications: false },
			uiCustomizations: { hideAdvancedOptions: true }
		}
	})
	@IsOptional()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	preferences?: Record<string, any>;

	/**
	 * Compliance & Security
	 */
	@ApiPropertyOptional({
		type: Date,
		description: 'Timestamp when the plugin was approved for this tenant'
	})
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ type: isBetterSqlite3() ? 'text' : 'timestamp', nullable: true })
	approvedAt?: Date;

	@ApiPropertyOptional({
		type: Boolean,
		description: 'Whether plugin data handling complies with tenant data policies',
		default: true
	})
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	isDataCompliant?: boolean;

	@ApiPropertyOptional({
		type: [String],
		description: 'List of compliance certifications applicable to this tenant',
		example: ['SOC2', 'GDPR', 'HIPAA']
	})
	@IsOptional()
	@MultiORMColumn({ type: 'simple-array', nullable: true })
	complianceCertifications?: string[];

	/*
	|--------------------------------------------------------------------------
	| @RelationId
	|--------------------------------------------------------------------------
	*/

	@ApiPropertyOptional({ type: () => String, description: 'ID of the user who approved the plugin' })
	@IsOptional()
	@IsUUID()
	@RelationId((it: PluginTenant) => it.approvedBy)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true, nullable: true, type: 'uuid' })
	approvedById?: ID;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne Relationships
	|--------------------------------------------------------------------------
	*/

	@ApiProperty({ type: () => Plugin, description: 'The plugin this configuration applies to' })
	@MultiORMManyToOne(() => Plugin, (plugin) => plugin.pluginTenants, {
		onDelete: 'CASCADE'
	})
	plugin: Relation<IPlugin>;

	@ApiPropertyOptional({ type: () => User, description: 'User who approved the plugin for this tenant' })
	@MultiORMManyToOne(() => User, {
		onDelete: 'SET NULL'
	})
	approvedBy?: Relation<IUser>;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany Relationships
	|--------------------------------------------------------------------------
	*/

	@ApiPropertyOptional({
		type: () => PluginSetting,
		isArray: true,
		description: 'Plugin settings specific to this tenant'
	})
	@MultiORMOneToMany(() => PluginSetting, (it) => it.pluginTenant, {
		cascade: true
	})
	settings?: Relation<IPluginSetting[]>;

	@ApiPropertyOptional({
		type: () => PluginSubscription,
		isArray: true,
		description: 'Active subscriptions for this plugin tenant'
	})
	@MultiORMOneToMany(() => PluginSubscription, (it) => it.pluginTenant, {
		cascade: true
	})
	subscriptions?: Relation<IPluginSubscription[]>;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany Relationships
	|--------------------------------------------------------------------------
	*/

	@ApiPropertyOptional({
		type: () => Role,
		isArray: true,
		description: 'Roles explicitly allowed to access this plugin'
	})
	@MultiORMManyToMany(() => Role, {
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'plugin_tenant_allowed_roles',
		joinColumn: 'pluginTenantId',
		inverseJoinColumn: 'roleId'
	})
	@JoinTable({ name: 'plugin_tenant_allowed_roles' })
	allowedRoles?: Relation<IRole[]>;

	@ApiPropertyOptional({
		type: () => User,
		isArray: true,
		description: 'Users explicitly allowed to access this plugin'
	})
	@MultiORMManyToMany(() => User, {
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'plugin_tenant_allowed_users',
		joinColumn: 'pluginTenantId',
		inverseJoinColumn: 'userId'
	})
	@JoinTable({ name: 'plugin_tenant_allowed_users' })
	allowedUsers?: Relation<IUser[]>;

	@ApiPropertyOptional({
		type: () => User,
		isArray: true,
		description: 'Users explicitly denied access to this plugin'
	})
	@MultiORMManyToMany(() => User, {
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'plugin_tenant_denied_users',
		joinColumn: 'pluginTenantId',
		inverseJoinColumn: 'userId'
	})
	@JoinTable({ name: 'plugin_tenant_denied_users' })
	deniedUsers?: Relation<IUser[]>;

	/*
	|--------------------------------------------------------------------------
	| @VirtualColumn
	|--------------------------------------------------------------------------
	*/

	@VirtualMultiOrmColumn()
	get isQuotaExceeded(): boolean {
		return !this.canInstallMore() || !this.canAddMoreUsers();
	}

	@VirtualMultiOrmColumn()
	get hasLimits(): boolean {
		return (
			(this.maxInstallations !== null && this.maxInstallations !== undefined && this.maxInstallations !== -1) ||
			(this.maxActiveUsers !== null && this.maxActiveUsers !== undefined && this.maxActiveUsers !== -1)
		);
	}

	@VirtualMultiOrmColumn()
	get installationUtilization(): number {
		if (!this.maxInstallations || this.maxInstallations === -1) return 0;
		return ((this.currentInstallations || 0) / this.maxInstallations) * 100;
	}

	@VirtualMultiOrmColumn()
	get userUtilization(): number {
		if (!this.maxActiveUsers || this.maxActiveUsers === -1) return 0;
		return ((this.currentActiveUsers || 0) / this.maxActiveUsers) * 100;
	}

	/*
	|--------------------------------------------------------------------------
	| Business Logic Methods - Availability & Access Control
	|--------------------------------------------------------------------------
	*/

	/**
	 * Check if plugin is available for use in this tenant
	 * @returns true if plugin is enabled
	 */
	public isAvailable(): boolean {
		return this.enabled === true && !this.isArchived;
	}

	/**
	 * Check if user has access to this plugin based on roles and explicit permissions
	 * @param userId - User ID to check
	 * @param userRoles - Array of roles the user has
	 * @returns true if user has access
	 */
	public hasUserAccess(userId: string, userRoles: IRole[]): boolean {
		if (!this.isAvailable()) {
			return false;
		}

		// Check explicit denials first (highest priority)
		if (this.deniedUsers?.some((user) => user.id === userId)) {
			return false;
		}

		// Check explicit allowances (overrides role restrictions)
		if (this.allowedUsers?.some((user) => user.id === userId)) {
			return true;
		}

		// Check role-based access
		if (this.allowedRoles && this.allowedRoles.length > 0) {
			return userRoles.some((userRole) =>
				this.allowedRoles!.some((allowedRole) => allowedRole.id === userRole.id)
			);
		}

		// Default: allow access if no restrictions are configured
		return true;
	}

	/**
	 * Check if tenant can install more instances based on quota
	 * @returns true if more installations are allowed
	 */
	public canInstallMore(): boolean {
		if (!this.isAvailable()) {
			return false;
		}

		// Unlimited or no limit set
		if (this.maxInstallations === -1 || this.maxInstallations === null || this.maxInstallations === undefined) {
			return true;
		}

		return (this.currentInstallations || 0) < this.maxInstallations;
	}

	/**
	 * Check if tenant can add more active users based on quota
	 * @returns true if more users can be added
	 */
	public canAddMoreUsers(): boolean {
		if (!this.isAvailable()) {
			return false;
		}

		// Unlimited or no limit set
		if (this.maxActiveUsers === -1 || this.maxActiveUsers === null || this.maxActiveUsers === undefined) {
			return true;
		}

		return (this.currentActiveUsers || 0) < this.maxActiveUsers;
	}

	/**
	 * Check if plugin is mandatory for users in this tenant
	 * @returns true if plugin is mandatory and available
	 */
	public isMandatoryForTenant(): boolean {
		return this.isMandatory === true && this.isAvailable();
	}

	/**
	 * Check if plugin requires approval for installation
	 * @returns true if approval is required
	 */
	public needsApprovalForInstallation(): boolean {
		return this.requiresApproval === true;
	}

	/**
	 * Check if plugin can be auto-installed
	 * @returns true if auto-install is enabled and requirements are met
	 */
	public canAutoInstall(): boolean {
		return this.autoInstall === true && this.isAvailable() && !this.needsApprovalForInstallation();
	}

	/*
	|--------------------------------------------------------------------------
	| Configuration Management
	|--------------------------------------------------------------------------
	*/

	/**
	 * Get effective configuration for this plugin tenant
	 * @returns Merged configuration object
	 */
	public getEffectiveConfiguration(): Record<string, any> {
		return { ...this.tenantConfiguration };
	}

	/**
	 * Update tenant-specific configuration (merges with existing)
	 * @param config - Configuration object to merge
	 */
	public updateConfiguration(config: Record<string, any>): void {
		this.tenantConfiguration = {
			...this.tenantConfiguration,
			...config
		};
	}

	/**
	 * Replace entire tenant configuration
	 * @param config - New configuration object
	 */
	public setConfiguration(config: Record<string, any>): void {
		this.tenantConfiguration = config;
	}

	/**
	 * Update tenant preferences (merges with existing)
	 * @param prefs - Preferences object to merge
	 */
	public updatePreferences(prefs: Record<string, any>): void {
		this.preferences = {
			...this.preferences,
			...prefs
		};
	}

	/**
	 * Replace entire preferences
	 * @param prefs - New preferences object
	 */
	public setPreferences(prefs: Record<string, any>): void {
		this.preferences = prefs;
	}

	/*
	|--------------------------------------------------------------------------
	| Usage Tracking
	|--------------------------------------------------------------------------
	*/

	/**
	 * Increment installation count
	 * @throws Error if quota would be exceeded
	 */
	public incrementInstallations(): void {
		if (!this.canInstallMore()) {
			throw new Error('Installation quota exceeded');
		}
		this.currentInstallations = (this.currentInstallations || 0) + 1;
	}

	/**
	 * Decrement installation count (safely prevents negative values)
	 */
	public decrementInstallations(): void {
		this.currentInstallations = Math.max((this.currentInstallations || 1) - 1, 0);
	}

	/**
	 * Increment active user count
	 * @throws Error if quota would be exceeded
	 */
	public incrementActiveUsers(): void {
		if (!this.canAddMoreUsers()) {
			throw new Error('Active user quota exceeded');
		}
		this.currentActiveUsers = (this.currentActiveUsers || 0) + 1;
	}

	/**
	 * Decrement active user count (safely prevents negative values)
	 */
	public decrementActiveUsers(): void {
		this.currentActiveUsers = Math.max((this.currentActiveUsers || 1) - 1, 0);
	}

	/**
	 * Reset usage counters to zero
	 */
	public resetUsageCounters(): void {
		this.currentInstallations = 0;
		this.currentActiveUsers = 0;
	}

	/*
	|--------------------------------------------------------------------------
	| State Management
	|--------------------------------------------------------------------------
	*/

	/**
	 * Enable plugin for tenant
	 */
	public enable(): void {
		if (this.isArchived) {
			throw new Error('Cannot enable an archived plugin tenant');
		}
		this.enabled = true;
	}

	/**
	 * Mark plugin as archived (cannot be enabled unless restored)
	 */
	public archive(): void {
		this.isArchived = true;
		this.enabled = false;
	}

	/**
	 * Restore plugin from archived state
	 */
	public restore(): void {
		this.isArchived = false;
	}

	/**
	 * Disable plugin for tenant
	 */
	public disable(): void {
		this.enabled = false;
	}

	/**
	 * Toggle plugin enabled state
	 * @returns New enabled state
	 */
	public toggleEnabled(): boolean {
		this.enabled = !this.enabled;
		return this.enabled;
	}

	/**
	 * Approve plugin for tenant
	 * @param approvedBy - User who approved the plugin
	 */
	public approve(approvedBy: IUser): void {
		this.approvedAt = new Date();
		this.approvedBy = approvedBy;
		this.approvedById = approvedBy.id;
		this.enable();
	}

	/**
	 * Revoke approval for plugin
	 */
	public revokeApproval(): void {
		this.approvedAt = undefined;
		this.approvedBy = undefined;
		this.approvedById = undefined;
		this.disable();
	}

	/**
	 * Check if plugin is approved
	 * @returns true if plugin has been approved
	 */
	public isApproved(): boolean {
		return (this.approvedAt !== null && this.approvedAt !== undefined) || !!this.approvedById;
	}

	/*
	|--------------------------------------------------------------------------
	| Access Control Management - Users
	|--------------------------------------------------------------------------
	*/

	/**
	 * Add user to allowed list
	 * @param user - User to allow
	 */
	public allowUser(user: IUser): void {
		if (!this.allowedUsers) {
			this.allowedUsers = [];
		}

		if (!this.allowedUsers.some((u) => u.id === user.id)) {
			this.allowedUsers.push(user);
		}

		// Remove from denied list if present
		this.removeDeniedUser(user.id);
	}

	/**
	 * Remove user from allowed list
	 * @param userId - ID of user to remove from allowed list
	 */
	public removeAllowedUser(userId: string): void {
		if (this.allowedUsers) {
			this.allowedUsers = this.allowedUsers.filter((u) => u.id !== userId);
		}
	}

	/**
	 * Add user to denied list
	 * @param user - User to deny
	 */
	public denyUser(user: IUser): void {
		if (!this.deniedUsers) {
			this.deniedUsers = [];
		}

		if (!this.deniedUsers.some((u) => u.id === user.id)) {
			this.deniedUsers.push(user);
		}

		// Remove from allowed list if present
		this.removeAllowedUser(user.id);
	}

	/**
	 * Remove user from denied list
	 * @param userId - ID of user to remove from denied list
	 */
	public removeDeniedUser(userId: string): void {
		if (this.deniedUsers) {
			this.deniedUsers = this.deniedUsers.filter((u) => u.id !== userId);
		}
	}

	/**
	 * Clear all user-specific access controls
	 */
	public clearUserAccessControls(): void {
		this.allowedUsers = [];
		this.deniedUsers = [];
	}

	/*
	|--------------------------------------------------------------------------
	| Access Control Management - Roles
	|--------------------------------------------------------------------------
	*/

	/**
	 * Add role to allowed list
	 * @param role - Role to allow
	 */
	public allowRole(role: IRole): void {
		if (!this.allowedRoles) {
			this.allowedRoles = [];
		}

		if (!this.allowedRoles.some((r) => r.id === role.id)) {
			this.allowedRoles.push(role);
		}
	}

	/**
	 * Remove role from allowed list
	 * @param roleId - ID of role to remove
	 */
	public removeAllowedRole(roleId: string): void {
		if (this.allowedRoles) {
			this.allowedRoles = this.allowedRoles.filter((r) => r.id !== roleId);
		}
	}

	/**
	 * Clear all role-based access controls
	 */
	public clearRoleAccessControls(): void {
		this.allowedRoles = [];
	}

	/**
	 * Clear all access controls (both users and roles)
	 */
	public clearAllAccessControls(): void {
		this.clearUserAccessControls();
		this.clearRoleAccessControls();
	}

	/*
	|--------------------------------------------------------------------------
	| Factory Methods
	|--------------------------------------------------------------------------
	*/

	/**
	 * Factory method to create a new plugin-tenant relationship
	 * @param params - Configuration parameters
	 * @returns New PluginTenant instance
	 */
	public static create(params: Partial<IPluginTenant>): PluginTenant {
		const pluginTenant = new PluginTenant();

		// Apply all params first, then override with defaults for undefined values
		Object.assign(pluginTenant, params);

		// Apply defaults only for undefined values (nullish coalescing)
		pluginTenant.scope ??= PluginScope.USER;
		pluginTenant.enabled ??= true;
		pluginTenant.autoInstall ??= false;
		pluginTenant.requiresApproval ??= true;
		pluginTenant.isMandatory ??= false;
		pluginTenant.isDataCompliant ??= true;

		// Always reset counters for new instances
		pluginTenant.currentInstallations = params.currentInstallations ?? 0;
		pluginTenant.currentActiveUsers = params.currentActiveUsers ?? 0;

		return pluginTenant;
	}

	/**
	 * Create a plugin tenant with unlimited access
	 * @param input - Plugin to create tenant relationship for
	 * @returns New PluginTenant instance with no restrictions
	 */
	public static createUnlimited(input: IPluginTenant): PluginTenant {
		return PluginTenant.create({
			...input,
			enabled: true,
			autoInstall: false,
			requiresApproval: false,
			maxInstallations: -1,
			maxActiveUsers: -1
		});
	}

	/**
	 * Create a plugin tenant with strict restrictions
	 * @param plugin - Plugin to create tenant relationship for
	 * @param allowedRoles - Roles that can access the plugin
	 * @returns New PluginTenant instance with restrictions
	 */
	public static createRestricted(input: IPluginTenant, allowedRoles?: IRole[]): PluginTenant {
		return PluginTenant.create({
			...input,
			enabled: false,
			autoInstall: false,
			requiresApproval: true,
			allowedRoles
		});
	}
}
