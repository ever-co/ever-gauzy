import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { JoinColumn, Relation, RelationId } from 'typeorm';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne, TenantOrganizationBaseEntity } from '@gauzy/core';
import { IPluginSetting, PluginSettingDataType } from '../../shared/models/plugin-setting.model';
import { IPlugin } from '../../shared/models/plugin.model';
import { IPluginTenant } from '../../shared/models/plugin-tenant.model';
import { IPluginCategory } from '../../shared/models/plugin-category.model';
import { Plugin } from './plugin.entity';
import { PluginTenant } from './plugin-tenant.entity';
import { ID, IUser } from '@gauzy/contracts';

@MultiORMEntity('plugin_settings')
export class PluginSetting extends TenantOrganizationBaseEntity implements IPluginSetting {
	@ApiProperty({ type: String, description: 'Setting key/name' })
	@IsNotEmpty({ message: 'Setting key is required' })
	@IsString({ message: 'Setting key must be a string' })
	@MultiORMColumn()
	key: string;

	@ApiProperty({ type: String, description: 'Setting value (stored as JSON string)' })
	@IsNotEmpty({ message: 'Setting value is required' })
	@MultiORMColumn({ type: 'jsonb' })
	value: Record<string, any>;

	@ApiProperty({ type: Boolean, description: 'Whether the setting is required' })
	@IsBoolean({ message: 'isRequired must be a boolean' })
	@MultiORMColumn({ type: 'boolean', default: false })
	isRequired: boolean;

	@ApiProperty({ type: Boolean, description: 'Whether the setting is encrypted/sensitive' })
	@IsBoolean({ message: 'isEncrypted must be a boolean' })
	@MultiORMColumn({ type: 'boolean', default: false })
	isEncrypted: boolean;

	@ApiPropertyOptional({ type: String, description: 'Setting description/help text' })
	@IsOptional()
	@IsString({ message: 'Description must be a string' })
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: Number, description: 'Display order for UI' })
	@IsOptional()
	@MultiORMColumn({ type: 'int', nullable: true })
	order?: number;

	@ApiPropertyOptional({ type: String, description: 'Validation rules (JSON string)' })
	@IsOptional()
	@IsString({ message: 'Validation rules must be a string' })
	@MultiORMColumn({ type: 'text', nullable: true })
	validationRules?: string;

	@ApiProperty({ enum: PluginSettingDataType, description: 'Data type of the setting' })
	@IsEnum(PluginSettingDataType)
	@MultiORMColumn({ type: 'simple-enum', enum: PluginSettingDataType, default: PluginSettingDataType.STRING })
	dataType: PluginSettingDataType;

	@ApiPropertyOptional({ type: String, description: 'Default value for the setting' })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	defaultValue?: string;

	/*
	 * Plugin relationship
	 */
	@MultiORMColumn({ type: 'uuid', relationId: true })
	@RelationId((pluginSetting: PluginSetting) => pluginSetting.plugin)
	pluginId: ID;

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
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	@RelationId((pluginSetting: PluginSetting) => pluginSetting.pluginTenant)
	pluginTenantId?: ID;

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
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	@RelationId((pluginSetting: PluginSetting) => pluginSetting.category)
	categoryId?: ID;

	@MultiORMManyToOne('PluginCategory', 'settings', {
		onDelete: 'CASCADE',
		nullable: true
	})
	@JoinColumn()
	category?: Relation<IPluginCategory>;

	@MultiORMManyToOne('User', { onDelete: 'SET NULL', nullable: true })
	@JoinColumn()
	updatedBy?: IUser;
}
