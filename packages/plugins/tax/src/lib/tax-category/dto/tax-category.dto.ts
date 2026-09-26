import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * Tax category request DTO validation.
 */
export class TaxCategoryDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	readonly name: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	readonly code: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly isDefault: boolean;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata: Record<string, unknown>;
}
