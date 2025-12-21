import { PluginSettingDataType } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Create Plugin Setting DTO
 */
export class CreatePluginSettingDTO {
	@ApiProperty({ type: String, description: 'Plugin ID' })
	@IsNotEmpty()
	@IsUUID()
	pluginId: string;

	@ApiPropertyOptional({ type: String, description: 'Plugin Tenant ID' })
	@IsOptional()
	@IsUUID()
	pluginTenantId?: string;

	@ApiProperty({ type: String, description: 'Setting key' })
	@IsNotEmpty()
	@IsString()
	key: string;

	@ApiPropertyOptional({ description: 'Setting value' })
	@IsOptional()
	value?: any;

	@ApiPropertyOptional({ type: Boolean, description: 'Is setting required' })
	@IsOptional()
	@IsBoolean()
	isRequired?: boolean;

	@ApiPropertyOptional({ type: Boolean, description: 'Is setting encrypted' })
	@IsOptional()
	@IsBoolean()
	isEncrypted?: boolean;

	@ApiPropertyOptional({ type: String, description: 'Setting description' })
	@IsOptional()
	@IsString()
	description?: string;

	@ApiPropertyOptional({ type: Number, description: 'Setting order' })
	@IsOptional()
	order?: number;

	@ApiPropertyOptional({ type: Object, description: 'Validation rules' })
	@IsOptional()
	validationRules?: Record<string, any>;

	@ApiPropertyOptional({ enum: PluginSettingDataType, description: 'Data type' })
	@IsOptional()
	@IsEnum(PluginSettingDataType)
	dataType?: PluginSettingDataType;

	@ApiPropertyOptional({ description: 'Default value' })
	@IsOptional()
	defaultValue?: any;
}

/**
 * Update Plugin Setting DTO
 */
export class UpdatePluginSettingDTO {
	@ApiPropertyOptional({ description: 'Setting value' })
	@IsOptional()
	value?: any;

	@ApiPropertyOptional({ enum: PluginSettingDataType, description: 'Data type' })
	@IsOptional()
	@IsEnum(PluginSettingDataType)
	dataType?: PluginSettingDataType;

	@ApiPropertyOptional({ type: Boolean, description: 'Is setting required' })
	@IsOptional()
	@IsBoolean()
	isRequired?: boolean;

	@ApiPropertyOptional({ type: Boolean, description: 'Is setting encrypted' })
	@IsOptional()
	@IsBoolean()
	isEncrypted?: boolean;

	@ApiPropertyOptional({ description: 'Default value' })
	@IsOptional()
	defaultValue?: any;

	@ApiPropertyOptional({ type: String, description: 'Setting description' })
	@IsOptional()
	@IsString()
	description?: string;

	@ApiPropertyOptional({ type: Number, description: 'Setting order' })
	@IsOptional()
	order?: number;

	@ApiPropertyOptional({ type: Object, description: 'Validation rules' })
	@IsOptional()
	validationRules?: Record<string, any>;
}

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
