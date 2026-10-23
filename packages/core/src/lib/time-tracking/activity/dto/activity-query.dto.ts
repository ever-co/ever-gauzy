import { IGetActivitiesInput, ReportGroupFilterEnum } from '@gauzy/contracts';
import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { FiltersQueryDTO, SelectorsQueryDTO } from '../../../shared/dto';

/**
 * Get activities request DTO validation
 */
export class ActivityQueryDTO
	extends IntersectionType(FiltersQueryDTO, SelectorsQueryDTO)
	implements IGetActivitiesInput
{
	@ApiPropertyOptional({ type: () => Array, enum: ReportGroupFilterEnum })
	@IsOptional()
	@IsEnum(ReportGroupFilterEnum)
	readonly groupBy: ReportGroupFilterEnum;

	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	readonly types: string[];

	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	readonly titles: string[];

	/**
	 * Page size for `GET /timesheet/activity`. Declared so the whitelisting pipe
	 * keeps it: without it a caller could never read past the endpoint's default
	 * first page of 30.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 500 })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => Number.parseInt(value, 10))
	@IsInt()
	@Min(1)
	@Max(500)
	readonly limit: number;

	/** Zero-based page for `GET /timesheet/activity`, read with `limit`. */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => Number.parseInt(value, 10))
	@IsInt()
	@Min(0)
	readonly page: number;
}
