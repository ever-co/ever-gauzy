import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { JoinColumn, Relation, RelationId } from 'typeorm';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne, TenantOrganizationBaseEntity } from '@gauzy/core';
import { IPluginSetting } from '../../shared/models/plugin-setting.model';
import { IPlugin } from '../../shared/models/plugin.model';
import { IPluginTenant } from '../../shared/models/plugin-tenant.model';
import { IPluginCategory } from '../../shared/models/plugin-category.model';
import { PluginSettingDataType } from '../../shared/models/plugin-setting.model';
import { Plugin } from './plugin.entity';
import { PluginTenant } from './plugin-tenant.entity';

@MultiORMEntity('plugin_settings')
export class PluginSetting extends TenantOrganizationBaseEntity implements IPluginSetting {
	@ApiProperty({ type: String, description: 'Setting key/name' })
	@IsNotEmpty({ message: 'Setting key is required' })
	@IsString({ message: 'Setting key must be a string' })
	@MultiORMColumn()
	key: string;

	@ApiProperty({ type: String, description: 'Setting value (stored as JSON string)' })
	@IsNotEmpty({ message: 'Setting value is required' })
	@IsString({ message: 'Setting value must be a string' })
	@MultiORMColumn({ type: 'text' })
	value: string;

	@ApiProperty({ enum: PluginSettingDataType, description: 'Setting data type' })
	@IsEnum(PluginSettingDataType, { message: 'Invalid setting data type' })
	@MultiORMColumn({ type: 'simple-enum', enum: PluginSettingDataType, default: PluginSettingDataType.STRING })
	dataType: PluginSettingDataType;

	@ApiProperty({ type: Boolean, description: 'Whether the setting is required' })
	@IsBoolean({ message: 'isRequired must be a boolean' })
	@MultiORMColumn({ type: 'boolean', default: false })
	isRequired: boolean;

	@ApiProperty({ type: Boolean, description: 'Whether the setting is encrypted/sensitive' })
	@IsBoolean({ message: 'isEncrypted must be a boolean' })
	@MultiORMColumn({ type: 'boolean', default: false })
	isEncrypted: boolean;

	@ApiPropertyOptional({ type: String, description: 'Default value for the setting' })
	@IsOptional()
	@IsString({ message: 'Default value must be a string' })
	@MultiORMColumn({ type: 'text', nullable: true })
	defaultValue?: string;

	@ApiPropertyOptional({ type: String, description: 'Setting description/help text' })
	@IsOptional()
	@IsString({ message: 'Description must be a string' })
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: String, description: 'Setting category/group' })
	@IsOptional()
	@IsString({ message: 'Category must be a string' })
	@MultiORMColumn({ nullable: true })
	category?: string;

	@ApiPropertyOptional({ type: Number, description: 'Display order for UI' })
	@IsOptional()
	@MultiORMColumn({ type: 'int', nullable: true })
	order?: number;

	@ApiPropertyOptional({ type: String, description: 'Validation rules (JSON string)' })
	@IsOptional()
	@IsString({ message: 'Validation rules must be a string' })
	@MultiORMColumn({ type: 'text', nullable: true })
	validationRules?: string;

	/*
	 * Plugin relationship
	 */
	@MultiORMColumn({ type: 'uuid' })
	@RelationId((pluginSetting: PluginSetting) => pluginSetting.plugin)
	pluginId: string;

	@MultiORMManyToOne(() => Plugin, { onDelete: 'CASCADE' })
	@JoinColumn()
	plugin: Relation<IPlugin>;

	/*
	 * Plugin Tenant relationship (optional for tenant-specific settings)
	 */
	@ApiPropertyOptional({ type: String, description: 'Plugin tenant ID for tenant-specific settings' })
	@IsOptional()
	@IsUUID()
	@ValidateIf((object, value) => value !== null)
	@MultiORMColumn({ type: 'uuid', nullable: true })
	@RelationId((pluginSetting: PluginSetting) => pluginSetting.pluginTenant)
	pluginTenantId?: string;

	@MultiORMManyToOne(() => PluginTenant, { onDelete: 'CASCADE', nullable: true })
	@JoinColumn()
	pluginTenant?: Relation<IPluginTenant>;

	/*
	 * Plugin Category relationship (for default category settings)
	 */
	@ApiPropertyOptional({ type: String, description: 'Plugin category ID for default category settings' })
	@IsOptional()
	@IsUUID()
	@ValidateIf((object, value) => value !== null)
	@MultiORMColumn({ type: 'uuid', nullable: true })
	@RelationId((pluginSetting: PluginSetting) => pluginSetting.pluginCategory)
	pluginCategoryId?: string;

	@MultiORMManyToOne('PluginCategory', 'defaultSettings', {
		onDelete: 'CASCADE',
		nullable: true
	})
	@JoinColumn()
	pluginCategory?: Relation<IPluginCategory>;
}
