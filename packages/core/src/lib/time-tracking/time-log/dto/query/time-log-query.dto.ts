import { ApiPropertyOptional, IntersectionType, OmitType, PickType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsTimeZone, IsUUID } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { IGetTimeLogReportInput, ITimesheet, ReportGroupFilterEnum } from '@gauzy/contracts';
import { parseToBoolean } from '@gauzy/utils';
import { BaseQueryDTO } from '../../../../core/dto/base-query.dto';
import { FiltersQueryDTO, RelationsQueryDTO, SelectorsQueryDTO } from '../../../../shared/dto';

/**
 * Get time log request DTO validation
 */
export class TimeLogQueryDTO
	extends IntersectionType(FiltersQueryDTO, IntersectionType(SelectorsQueryDTO, RelationsQueryDTO))
	implements IGetTimeLogReportInput
{
	@ApiPropertyOptional({ type: () => String, enum: ReportGroupFilterEnum })
	@IsOptional()
	@IsEnum(ReportGroupFilterEnum)
	readonly groupBy: ReportGroupFilterEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly timesheetId: ITimesheet['id'];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsTimeZone()
	readonly timeZone: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	readonly isEdited: boolean;

	@ApiPropertyOptional({ type: () => Boolean, description: 'Count billable time logs only' })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	readonly billableOnly: boolean;

	@ApiPropertyOptional({
		type: () => Boolean,
		description:
			"With teamIds, also count the time the members of the caller's teams logged without a team. The daily report " +
			"then states each row's organizationTeamId, null for that time."
	})
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	readonly includeTimeWithoutTeam: boolean;

	@ApiPropertyOptional({
		type: () => Boolean,
		description:
			'Leave out the time a live invoice bills: a time log whose invoice line is not removed and belongs to an ' +
			'invoice that is neither removed nor void. Without it, every log is counted, invoiced or not.'
	})
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	readonly notInvoiced: boolean;
}

/**
 * The budget limit routes count every log against the budget through their own queries: `billableOnly`,
 * `includeTimeWithoutTeam` and `notInvoiced` are not offered there, and the whitelist drops them if sent.
 */
export class TimeLogBudgetQueryDTO extends OmitType(TimeLogQueryDTO, [
	'billableOnly',
	'includeTimeWithoutTeam',
	'notInvoiced'
] as const) {}

/**
 * Get time log list request DTO validation: the filters above plus an optional page (`take`, and
 * `skip` as a 1-based page number). Without `take` the whole list is returned, as the timesheet and
 * dashboard clients that sum it expect.
 */
export class TimeLogListQueryDTO extends IntersectionType(TimeLogQueryDTO, PickType(BaseQueryDTO, ['take', 'skip'])) {}
