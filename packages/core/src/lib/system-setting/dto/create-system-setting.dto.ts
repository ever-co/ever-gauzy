import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ISystemSettingCreateInput, SystemSettingScope } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * Create System Setting DTO validation
 */
export class CreateSystemSettingDTO extends TenantOrganizationBaseDTO implements ISystemSettingCreateInput {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly value?: string;
}

/**
 * Save System Settings DTO validation
 */
export class SaveSystemSettingsDTO {
	@ApiProperty({ enum: SystemSettingScope })
	@IsNotEmpty()
	@IsEnum(SystemSettingScope)
	readonly scope: SystemSettingScope;

	@ApiProperty({ type: () => Object })
	@IsNotEmpty()
	@IsObject()
	readonly settings: Record<string, any>;
}

/**
 * System Setting Query DTO validation
 */
export class SystemSettingQueryDTO {
	@ApiPropertyOptional({ enum: SystemSettingScope })
	@IsOptional()
	@IsEnum(SystemSettingScope)
	readonly scope?: SystemSettingScope;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly names?: string;
}
