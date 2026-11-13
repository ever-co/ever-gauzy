import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * A page of the contacts an employee can be assigned to: the organization (whose membership the base DTO checks),
 * an optional name to match, the page size and the page, counted from 1.
 */
export class OrganizationContactAssignableQueryDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String, description: 'Matched as a case-insensitive substring of the name.' })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly name?: string;

	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	readonly take?: number;

	@ApiPropertyOptional({ type: () => Number, minimum: 1, description: 'The page, counted from 1.' })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	readonly skip?: number;
}
