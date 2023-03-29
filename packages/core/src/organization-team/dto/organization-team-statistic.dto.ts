import {
	ApiPropertyOptional,
	IntersectionType,
	PickType,
} from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import {
	IDateRangePicker,
	IOrganizationTeamStatisticInput,
} from '@gauzy/contracts';
import { parseToBoolean } from '@gauzy/common';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { DateRangeQueryDTO, RelationsQueryDTO } from './../../shared/dto';
/**
 * Get team statistic request DTO validation
 */
export class OrganizationTeamStatisticDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		RelationsQueryDTO,
		PickType(DateRangeQueryDTO, ['startDate', 'endDate'])
	)
	implements IOrganizationTeamStatisticInput, IDateRangePicker
{
	/**
	 * Indicates if last worked task row should be included in entity result.
	 */
	@ApiPropertyOptional({ type: 'boolean' })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) =>
		value ? parseToBoolean(value) : false
	)
	readonly withLaskWorkedTask: boolean;
}
