import { ID, IUser, PluginStatus, PluginType } from '@gauzy/contracts';
import {
	BaseEntity,
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	User
} from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Index, JoinColumn, Relation, RelationId } from 'typeorm';
import { IPluginSetting, IPluginSubscription } from '../../shared/models';
import { IPluginCategory } from '../../shared/models/plugin-category.model';
import { IPluginSource } from '../../shared/models/plugin-source.model';
import { IPluginSubscriptionPlan } from '../../shared/models/plugin-subscription.model';
import { IPluginTag } from '../../shared/models/plugin-tag.model';
import { IPluginTenant } from '../../shared/models/plugin-tenant.model';
import { IPluginVersion } from '../../shared/models/plugin-version.model';
import { IPlugin } from '../../shared/models/plugin.model';
import { PluginCategory } from './plugin-category.entity';
import { PluginSetting } from './plugin-setting.entity';
import { PluginSubscriptionPlan } from './plugin-subscription-plan.entity';
import { PluginSubscription } from './plugin-subscription.entity';
import { PluginTag } from './plugin-tag.entity';
import { PluginTenant } from './plugin-tenant.entity';
import { PluginVersion } from './plugin-version.entity';

@Index(['name'], { unique: true })
@Index(['status', 'type'])
@Index(['status', 'isFeatured'])
@MultiORMEntity('plugins')
export class Plugin extends BaseEntity implements IPlugin {
	@ApiProperty({ type: String, description: 'Plugin name' })
	@IsNotEmpty({ message: 'Plugin name is required' })
	@IsString({ message: 'Plugin name must be a string' })
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: String, description: 'Plugin description', required: false })
	@IsOptional()
	@IsString({ message: 'Description must be a string' })
	@MultiORMColumn({ nullable: true })
	description?: string;

	@ApiProperty({ enum: PluginType, description: 'Type of the plugin' })
	@IsEnum(PluginType, { message: 'Invalid plugin type' })
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: PluginType, default: PluginType.DESKTOP })
	type: PluginType;

	@ApiProperty({ enum: PluginStatus, description: 'Status of the plugin' })
	@IsEnum(PluginStatus, { message: 'Invalid plugin status' })
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: PluginStatus, default: PluginStatus.ACTIVE })
	status: PluginStatus;

	@ApiProperty({ type: Boolean, description: 'Plugin is active or not', default: false })
	@IsOptional()
	@MultiORMColumn({ default: false })
	isActive?: boolean;

	/*
	 * Plugin Category relationship
	 */
	@ApiPropertyOptional({ type: String, description: 'Plugin category ID' })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	@ColumnIndex()
	@RelationId((plugin: Plugin) => plugin.category)
	categoryId?: string;

	@ApiPropertyOptional({ type: () => Object, description: 'Plugin category' })
	@MultiORMManyToOne(() => PluginCategory, (category) => category.plugins, {
		onDelete: 'SET NULL',
		nullable: true
	})
	@JoinColumn()
	category?: IPluginCategory;

	/*
	 * Plugin Versions relationship
	 */
	@ApiProperty({ type: () => Array, description: 'Versions of the plugin' })
	@MultiORMOneToMany(() => PluginVersion, (version) => version.plugin, { onDelete: 'SET NULL' })
	versions: IPluginVersion[];

	@ApiProperty({ type: String, description: 'Plugin author', required: false })
	@IsOptional()
	@IsString({ message: 'Author must be a string' })
	@MultiORMColumn({ nullable: true })
	author?: string;

	@ApiProperty({ type: String, description: 'Plugin license', required: false })
	@IsOptional()
	@IsString({ message: 'License must be a string' })
	@MultiORMColumn({ nullable: true })
	license?: string;

	@ApiProperty({ type: String, description: 'Homepage URL', required: false })
	@IsOptional()
	@IsString({ message: 'Homepage URL must be a string' })
	@MultiORMColumn({ nullable: true })
	homepage?: string;

	@ApiProperty({ type: String, description: 'Repository URL', required: false })
	@IsOptional()
	@IsString({ message: 'Repository URL must be a string' })
	@MultiORMColumn({ nullable: true })
	repository?: string;

	@ApiProperty({ type: () => User, description: 'User who uploaded the plugin', required: false })
	@MultiORMManyToOne(() => User, { nullable: true })
	@JoinColumn()
	uploadedBy?: IUser;

	@RelationId((plugin: Plugin) => plugin.uploadedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	uploadedById?: ID;

	@ApiProperty({ type: Date, description: 'Upload date', required: false })
	@IsOptional()
	@IsDate({ message: 'UploadedAt must be a valid date' })
	@MultiORMColumn({ nullable: true })
	uploadedAt?: Date;

	// Add subscription plan enabled flag
	@ApiProperty({ type: Boolean, description: 'Is subscription plan enabled', default: false })
	@IsOptional()
	@MultiORMColumn({ default: false })
	requiresSubscription?: boolean;

	@ApiProperty({ type: Boolean, description: 'Whether the plugin is featured', default: false })
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ default: false })
	isFeatured?: boolean;

	@ApiProperty({ type: Boolean, description: 'Whether the plugin is verified by Gauzy', default: false })
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ default: false })
	isVerified?: boolean;

	// Computed source
	source: IPluginSource;

	// Computed field
	downloadCount: number;

	// Computed version
	version: IPluginVersion;

	// Computed state
	installed: boolean;

	// Computed state - whether plugin has at least one subscription plan
	hasPlan: boolean;

	@ApiProperty({ type: Date, description: 'Last downloaded date', required: false })
	@IsOptional()
	@IsDate({ message: 'LastDownloadedAt must be a valid date' })
	@MultiORMColumn({ nullable: true })
	lastDownloadedAt?: Date;

	/*
	 * Plugin Tenants relationships - tenant-specific plugin configurations
	 */
	@ApiPropertyOptional({ type: () => Array, description: 'Plugin tenants for this plugin' })
	@MultiORMOneToMany(() => PluginTenant, (tenant) => tenant.plugin, {
		onDelete: 'CASCADE'
	})
	pluginTenants?: Relation<IPluginTenant[]>;

	/**
	 * Plugin Settings relationships - global plugin settings
	 */
	@ApiPropertyOptional({ type: () => Array, description: 'Plugin settings' })
	@MultiORMOneToMany(() => PluginSetting, (setting) => setting.plugin, {
		onDelete: 'CASCADE'
	})
	settings?: Relation<IPluginSetting[]>;

	/**
	 * Plugin Subscriptions relationships - subscriptions for this plugin
	 */
	@ApiPropertyOptional({ type: () => Array, description: 'Plugin subscriptions' })
	@MultiORMOneToMany(() => PluginSubscription, (subscription) => subscription.plugin, {
		onDelete: 'CASCADE'
	})
	subscriptions?: Relation<IPluginSubscription[]>;

	/**
	 * Plugin Subscription Plans relationships - available plans for this plugin
	 */
	@ApiPropertyOptional({ type: () => Array, description: 'Plugin subscription plans' })
	@MultiORMOneToMany(() => PluginSubscriptionPlan, (plan) => plan.plugin, {
		onDelete: 'CASCADE'
	})
	subscriptionPlans?: Relation<IPluginSubscriptionPlan[]>;

	/**
	 * Plugin Tags relationships - tag associations for this plugin
	 */
	@ApiPropertyOptional({ type: () => Array, description: 'Plugin tag relationships' })
	@MultiORMOneToMany(() => PluginTag, (pluginTag) => pluginTag.plugin, {
		onDelete: 'CASCADE'
	})
	pluginTags?: Relation<IPluginTag[]>;

	// Business Logic Methods

	/**
	 * Check if the plugin is published and available for installation
	 */
	public isPublished(): boolean {
		return this.status === PluginStatus.ACTIVE && this.isActive === true;
	}

	/**
	 * Get the latest version of the plugin
	 */
	public getLatestVersion(): IPluginVersion | undefined {
		if (!this.versions || this.versions.length === 0) {
			return undefined;
		}

		// Sort versions by release date (most recent first)
		return this.versions
			.filter((version) => version.releaseDate)
			.sort((a, b) => new Date(b.releaseDate!).getTime() - new Date(a.releaseDate!).getTime())[0];
	}

	/**
	 * Check if the plugin requires subscription for usage
	 */
	public requiresPayment(): boolean {
		return this.requiresSubscription === true;
	}

	/**
	 * Check if the plugin has been uploaded by a specific user
	 */
	public isUploadedBy(userId: ID): boolean {
		return this.uploadedById === userId;
	}

	/**
	 * Mark plugin as downloaded and increment download count
	 */
	public markAsDownloaded(): void {
		this.downloadCount = (this.downloadCount || 0) + 1;
		this.lastDownloadedAt = new Date();
	}

	/**
	 * Check if plugin can be activated
	 */
	public canBeActivated(): boolean {
		return this.isPublished() && this.versions && this.versions.length > 0;
	}

	/**
	 * Get total download count across all versions
	 */
	public getTotalDownloadCount(): number {
		if (!this.versions || this.versions.length === 0) {
			return 0;
		}

		return this.versions.reduce((total, version) => total + (version.downloadCount || 0), 0);
	}

	/**
	 * Check if plugin has valid subscription plans
	 */
	public hasValidSubscriptionPlans(): boolean {
		return this.hasPlan === true && this.subscriptionPlans && this.subscriptionPlans.length > 0;
	}

	/**
	 * Validate plugin data integrity
	 */
	public validate(): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!this.name || this.name.trim().length === 0) {
			errors.push('Plugin name is required');
		}

		if (!this.type) {
			errors.push('Plugin type is required');
		}

		if (!this.status) {
			errors.push('Plugin status is required');
		}

		if (this.requiresSubscription && (!this.subscriptionPlans || this.subscriptionPlans.length === 0)) {
			errors.push('Plugin requiring subscription must have at least one subscription plan');
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}

	// Static Methods

	/**
	 * Create a new plugin instance with default values
	 */
	public static create(data: Partial<Plugin>): Plugin {
		const plugin = new Plugin();
		Object.assign(plugin, {
			status: PluginStatus.ACTIVE,
			type: PluginType.DESKTOP,
			isActive: true,
			requiresSubscription: false,
			downloadCount: 0,
			versions: [],
			...data
		});
		return plugin;
	}

	/**
	 * Create a plugin for a specific platform type
	 */
	public static createForPlatform(name: string, type: PluginType, description?: string): Plugin {
		return Plugin.create({
			name,
			type,
			description,
			uploadedAt: new Date()
		});
	}

	/**
	 * Create a desktop plugin
	 */
	public static createDesktopPlugin(name: string, description?: string): Plugin {
		return Plugin.createForPlatform(name, PluginType.DESKTOP, description);
	}

	/**
	 * Create a web plugin
	 */
	public static createWebPlugin(name: string, description?: string): Plugin {
		return Plugin.createForPlatform(name, PluginType.WEB, description);
	}

	/**
	 * Create a mobile plugin
	 */
	public static createMobilePlugin(name: string, description?: string): Plugin {
		return Plugin.createForPlatform(name, PluginType.MOBILE, description);
	}

	/**
	 * Validate plugin name format
	 */
	public static isValidName(name: string): boolean {
		if (!name || typeof name !== 'string') return false;
		const trimmed = name.trim();
		return trimmed.length >= 3 && trimmed.length <= 100 && /^[a-zA-Z0-9._-]+$/.test(trimmed);
	}

	/**
	 * Validate plugin status
	 */
	public static isValidStatus(status: string): status is PluginStatus {
		return Object.values(PluginStatus).includes(status as PluginStatus);
	}

	/**
	 * Validate plugin type
	 */
	public static isValidType(type: string): type is PluginType {
		return Object.values(PluginType).includes(type as PluginType);
	}

	/**
	 * Get all available plugin statuses
	 */
	public static getAvailableStatuses(): PluginStatus[] {
		return Object.values(PluginStatus);
	}

	/**
	 * Get all available plugin types
	 */
	public static getAvailableTypes(): PluginType[] {
		return Object.values(PluginType);
	}

	/**
	 * Get plugins that are published and active
	 */
	public static getPublishedStatuses(): PluginStatus[] {
		return [PluginStatus.ACTIVE];
	}

	/**
	 * Compare two plugins by name
	 */
	public static compareName(a: Plugin, b: Plugin): number {
		return a.name.localeCompare(b.name);
	}

	/**
	 * Compare two plugins by upload date (newest first)
	 */
	public static compareUploadDate(a: Plugin, b: Plugin): number {
		if (!a.uploadedAt && !b.uploadedAt) return 0;
		if (!a.uploadedAt) return 1;
		if (!b.uploadedAt) return -1;
		return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
	}

	/**
	 * Compare two plugins by download count (most downloaded first)
	 */
	public static compareDownloadCount(a: Plugin, b: Plugin): number {
		return (b.downloadCount || 0) - (a.downloadCount || 0);
	}

	/**
	 * Filter plugins by status
	 */
	public static filterByStatus(plugins: Plugin[], status: PluginStatus): Plugin[] {
		return plugins.filter((plugin) => plugin.status === status);
	}

	/**
	 * Filter plugins by type
	 */
	public static filterByType(plugins: Plugin[], type: PluginType): Plugin[] {
		return plugins.filter((plugin) => plugin.type === type);
	}

	/**
	 * Filter published plugins
	 */
	public static filterPublished(plugins: Plugin[]): Plugin[] {
		return plugins.filter((plugin) => plugin.isPublished());
	}

	/**
	 * Filter plugins that require subscription
	 */
	public static filterPaid(plugins: Plugin[]): Plugin[] {
		return plugins.filter((plugin) => plugin.requiresPayment());
	}

	/**
	 * Filter free plugins
	 */
	public static filterFree(plugins: Plugin[]): Plugin[] {
		return plugins.filter((plugin) => !plugin.requiresPayment());
	}

	/**
	 * Search plugins by name or description
	 */
	public static search(plugins: Plugin[], query: string): Plugin[] {
		if (!query || query.trim().length === 0) return plugins;
		const searchTerm = query.toLowerCase().trim();
		return plugins.filter(
			(plugin) =>
				plugin.name.toLowerCase().includes(searchTerm) ||
				(plugin.description && plugin.description.toLowerCase().includes(searchTerm)) ||
				(plugin.author && plugin.author.toLowerCase().includes(searchTerm))
		);
	}

	/**
	 * Get plugins uploaded by a specific user
	 */
	public static filterByUploader(plugins: Plugin[], uploaderId: ID): Plugin[] {
		return plugins.filter((plugin) => plugin.isUploadedBy(uploaderId));
	}

	/**
	 * Group plugins by type
	 */
	public static groupByType(plugins: Plugin[]): Record<PluginType, Plugin[]> {
		const groups = Object.values(PluginType).reduce((acc, type) => {
			acc[type] = [];
			return acc;
		}, {} as Record<PluginType, Plugin[]>);

		plugins.forEach((plugin) => {
			if (groups[plugin.type]) {
				groups[plugin.type].push(plugin);
			}
		});

		return groups;
	}

	/**
	 * Group plugins by status
	 */
	public static groupByStatus(plugins: Plugin[]): Record<PluginStatus, Plugin[]> {
		const groups = Object.values(PluginStatus).reduce((acc, status) => {
			acc[status] = [];
			return acc;
		}, {} as Record<PluginStatus, Plugin[]>);

		plugins.forEach((plugin) => {
			if (groups[plugin.status]) {
				groups[plugin.status].push(plugin);
			}
		});

		return groups;
	}

	/**
	 * Get statistics for a collection of plugins
	 */
	public static getStatistics(plugins: Plugin[]): {
		total: number;
		published: number;
		byType: Record<PluginType, number>;
		byStatus: Record<PluginStatus, number>;
		paid: number;
		free: number;
		totalDownloads: number;
	} {
		const stats = {
			total: plugins.length,
			published: 0,
			byType: Object.values(PluginType).reduce(
				(acc, type) => ({ ...acc, [type]: 0 }),
				{} as Record<PluginType, number>
			),
			byStatus: Object.values(PluginStatus).reduce(
				(acc, status) => ({ ...acc, [status]: 0 }),
				{} as Record<PluginStatus, number>
			),
			paid: 0,
			free: 0,
			totalDownloads: 0
		};

		plugins.forEach((plugin) => {
			if (plugin.isPublished()) stats.published++;
			stats.byType[plugin.type]++;
			stats.byStatus[plugin.status]++;
			if (plugin.requiresPayment()) {
				stats.paid++;
			} else {
				stats.free++;
			}
			stats.totalDownloads += plugin.downloadCount || 0;
		});

		return stats;
	}
}
