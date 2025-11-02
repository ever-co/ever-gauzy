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

@Index('plugin_name_unique', ['name'], { unique: true })
@MultiORMEntity('plugin')
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
	@MultiORMColumn({ type: 'simple-enum', enum: PluginType, default: PluginType.DESKTOP })
	type: PluginType;

	@ApiProperty({ enum: PluginStatus, description: 'Status of the plugin' })
	@IsEnum(PluginStatus, { message: 'Invalid plugin status' })
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

	// Add subscription plan enbled flag
	@ApiProperty({ type: Boolean, description: 'Is subscription plan enabled', default: false })
	@IsOptional()
	@MultiORMColumn({ default: false })
	requiresSubscription?: boolean;

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
}
