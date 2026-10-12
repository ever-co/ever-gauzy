import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { IOfficialHolidayFindInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';

/**
 * Query filters for listing official holidays.
 */
export class OfficialHolidayQueryDTO extends TenantOrganizationBaseDTO implements IOfficialHolidayFindInput {
	@ApiPropertyOptional({ type: () => String, minLength: 2, maxLength: 2 })
	@Transform(({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
	@IsOptional()
	@IsString()
	@Length(2, 2)
	readonly countryCode?: string;

	@ApiPropertyOptional({ type: () => Number })
	@Transform(({ value }: TransformFnParams) => (value === undefined || value === null ? value : Number(value)))
	@IsOptional()
	@IsInt()
	@Min(1900)
	@Max(2999)
	readonly year?: number;
}
