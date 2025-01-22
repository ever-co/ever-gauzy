import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { IDateRangePicker, IOrganizationTeamStatisticInput } from '@gauzy/contracts';
import { parseToBoolean } from '@gauzy/utils';
import { DateRangeQueryDTO, RelationsQueryDTO } from './../../shared/dto';

/**
 * DTO for handling requests related to organization team statistics.
 * Combines date range and relations query features.
 */
export class OrganizationTeamStatisticDTO
	extends IntersectionType(DateRangeQueryDTO, RelationsQueryDTO)
	implements IOrganizationTeamStatisticInput, IDateRangePicker
{
	/**
	 * Indicates whether the last worked task row should be included in the entity result.
	 * Default value is set to false.
	 */
	@ApiPropertyOptional({ type: Boolean, default: false })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => (value ? parseToBoolean(value) : false))
	readonly withLastWorkedTask: boolean;
}
