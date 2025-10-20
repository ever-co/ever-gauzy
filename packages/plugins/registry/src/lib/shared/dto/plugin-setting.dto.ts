import { ApiProperty, ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsBoolean, IsUUID } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PluginSetting } from '../../domain/entities/plugin-setting.entity';
import { PluginSettingDataType } from '../../shared/models/plugin-setting.model';

/**
 * Create Plugin Setting DTO
 */
export class CreatePluginSettingDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	PickType(PluginSetting, [
		'key',
		'value',
		'isRequired',
		'isEncrypted',
		'description',
		'order',
		'validationRules',
		'dataType',
		'defaultValue'
	] as const)
) {
	@ApiProperty({ type: String, description: 'Plugin ID' })
	@IsNotEmpty()
	@IsUUID()
	pluginId: string;

	@ApiPropertyOptional({ type: String, description: 'Plugin Tenant ID' })
	@IsOptional()
	@IsUUID()
	pluginTenantId?: string;
}

/**
 * Update Plugin Setting DTO
 */
export class UpdatePluginSettingDTO extends PickType(CreatePluginSettingDTO, [
	'value',
	'dataType',
	'isRequired',
	'isEncrypted',
	'defaultValue',
	'description',
	'order',
	'validationRules'
] as const) {}

/**
 * Plugin Setting Query DTO
 */
export class PluginSettingQueryDTO {
	@ApiPropertyOptional({ type: String, description: 'Plugin ID' })
	@IsOptional()
	@IsUUID()
	pluginId?: string;

	@ApiPropertyOptional({ type: String, description: 'Plugin Tenant ID' })
	@IsOptional()
	@IsUUID()
	pluginTenantId?: string;

	@ApiPropertyOptional({ type: String, description: 'Setting key' })
	@IsOptional()
	@IsString()
	key?: string;

	@ApiPropertyOptional({ type: String, description: 'Setting category' })
	@IsOptional()
	@IsString()
	category?: string;

	@ApiPropertyOptional({ enum: PluginSettingDataType, description: 'Data type' })
	@IsOptional()
	@IsEnum(PluginSettingDataType)
	dataType?: PluginSettingDataType;
}

/**
 * Bulk Update Plugin Settings DTO
 */
export class BulkUpdatePluginSettingsDTO {
	@ApiProperty({ type: String, description: 'Plugin ID' })
	@IsNotEmpty()
	@IsUUID()
	pluginId: string;

	@ApiPropertyOptional({ type: String, description: 'Plugin Tenant ID' })
	@IsOptional()
	@IsUUID()
	pluginTenantId?: string;

	@ApiProperty({
		type: Array,
		description: 'Array of setting updates',
		example: [{ key: 'api_key', value: 'new_value' }]
	})
	@IsNotEmpty()
	settings: Array<{
		key: string;
		value: any;
	}>;
}

/**
 * Set Plugin Setting Value DTO
 */
export class SetPluginSettingValueDTO {
	@ApiProperty({ type: String, description: 'Plugin ID' })
	@IsNotEmpty()
	@IsUUID()
	pluginId: string;

	@ApiProperty({ type: String, description: 'Setting key' })
	@IsNotEmpty()
	@IsString()
	key: string;

	@ApiProperty({ description: 'Setting value' })
	@IsNotEmpty()
	value: any;

	@ApiPropertyOptional({ type: String, description: 'Plugin Tenant ID' })
	@IsOptional()
	@IsUUID()
	pluginTenantId?: string;
}
