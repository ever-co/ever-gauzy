import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import {
	IDateRangePicker,
	IEmployee,
	IOrganizationTeam,
	IOrganizationTeamStatisticInput,
	TimeLogSourceEnum,
} from '@gauzy/contracts';
import { parseToBoolean } from '@gauzy/common';
import { DateRangeQueryDTO, RelationsQueryDTO } from './../../shared/dto';
/**
 * Get team statistic request DTO validation
 */
export class OrganizationTeamStatisticDTO
	extends IntersectionType(DateRangeQueryDTO, RelationsQueryDTO)
	implements IOrganizationTeamStatisticInput, IDateRangePicker
{
	source?: TimeLogSourceEnum;
	todayStart?: string | Date;
	todayEnd?: string | Date;
	id?: string;
	createdAt?: Date;
	updatedAt?: Date;
	isActive?: boolean;
	isArchived?: boolean;
	deletedAt?: Date;
	employee?: IEmployee;
	employeeId?: string;
	organizationTeam?: IOrganizationTeam;
	organizationTeamId?: string;
	/**
	 * Indicates if last worked task row should be included in entity result.
	 */
	@ApiPropertyOptional({ type: 'boolean' })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) =>
		value ? parseToBoolean(value) : false
	)
	readonly withLaskWorkedTask: boolean;

	/**
	 * Indicates if organizationTeamId should be used to filter the records.
	 */
	@ApiPropertyOptional({ type: 'boolean' })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) =>
		value ? parseToBoolean(value) : false
	)
	readonly includeOrganizationTeamId?: boolean;
}
