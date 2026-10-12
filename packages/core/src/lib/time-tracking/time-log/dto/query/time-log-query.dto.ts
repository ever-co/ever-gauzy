import { ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
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
}

/**
 * Get time log list request DTO validation: the filters above plus an optional page (`take`, and
 * `skip` as a 1-based page number). Without `take` the whole list is returned, as the timesheet and
 * dashboard clients that sum it expect.
 */
export class TimeLogListQueryDTO extends IntersectionType(TimeLogQueryDTO, PickType(BaseQueryDTO, ['take', 'skip'])) {}
