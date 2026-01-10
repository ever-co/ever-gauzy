import { ID, IUser, PluginSettingDataType } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity,
	User
} from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { Index, JoinColumn, Relation, RelationId } from 'typeorm';
import { IPluginCategory } from '../../shared/models/plugin-category.model';
import { IPluginSetting } from '../../shared/models/plugin-setting.model';
import { IPluginTenant } from '../../shared/models/plugin-tenant.model';
import { IPlugin } from '../../shared/models/plugin.model';
import { PluginCategory } from './plugin-category.entity';
import { PluginTenant } from './plugin-tenant.entity';
import { Plugin } from './plugin.entity';

@Index(['pluginId', 'key', 'pluginTenantId'], { unique: true })
@MultiORMEntity('plugin_settings')
export class PluginSetting extends TenantOrganizationBaseEntity implements IPluginSetting {
	@ApiProperty({ type: String, description: 'Setting key/name' })
	@IsNotEmpty({ message: 'Setting key is required' })
	@IsString({ message: 'Setting key must be a string' })
	@MultiORMColumn()
	key: string;

	@ApiProperty({ type: String, description: 'Setting value string' })
	@IsNotEmpty({ message: 'Setting value is required' })
	@MultiORMColumn({ type: 'text' })
	value: string;

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
	@IsNumber({}, { message: 'Order must be a number' })
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
	@IsString({ message: 'Default value must be a string' })
	@MultiORMColumn({ nullable: true })
	defaultValue?: string;

	/*
	 * Plugin relationship
	 */
	@ApiProperty({ type: String, description: 'Plugin ID' })
	@IsNotEmpty({ message: 'Plugin ID is required' })
	@IsUUID()
	@RelationId((setting: PluginSetting) => setting.plugin)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	pluginId: ID;

	@ApiPropertyOptional({ type: () => Plugin, description: 'Plugin' })
	@MultiORMManyToOne(() => Plugin, (plugin) => plugin.settings, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	plugin: Relation<IPlugin>;

	/*
	 * Plugin Tenant relationship (optional for tenant-specific settings)
	 */
	@ApiPropertyOptional({ type: String, description: 'Plugin tenant ID for tenant-specific settings' })
	@IsOptional()
	@IsUUID()
	@ValidateIf((object, value) => value !== null)
	@RelationId((setting: PluginSetting) => setting.pluginTenant)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	pluginTenantId?: ID;

	@ApiPropertyOptional({ type: () => PluginTenant, description: 'Plugin tenant' })
	@MultiORMManyToOne(() => PluginTenant, (tenant) => tenant.settings, {
		onDelete: 'CASCADE',
		nullable: true
	})
	@JoinColumn()
	pluginTenant?: Relation<IPluginTenant>;

	/*
	 * Plugin Category relationship (for default category settings)
	 */
	@ApiPropertyOptional({ type: String, description: 'Plugin category ID for default category settings' })
	@IsOptional()
	@IsUUID()
	@ValidateIf((object, value) => value !== null)
	@RelationId((setting: PluginSetting) => setting.category)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	categoryId?: ID;

	@ApiPropertyOptional({ type: () => PluginCategory, description: 'Plugin category' })
	@MultiORMManyToOne(() => PluginCategory, {
		onDelete: 'CASCADE',
		nullable: true
	})
	@JoinColumn()
	category?: Relation<IPluginCategory>;

	/*
	 * User who last updated this setting
	 */
	@ApiPropertyOptional({ type: () => User, description: 'User who last updated this setting' })
	@MultiORMManyToOne(() => User, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	updatedBy?: Relation<IUser>;

	@ApiPropertyOptional({ type: String, description: 'ID of the user who last updated this setting' })
	@IsOptional()
	@IsUUID()
	@RelationId((setting: PluginSetting) => setting.updatedBy)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	updatedById?: ID;
}
