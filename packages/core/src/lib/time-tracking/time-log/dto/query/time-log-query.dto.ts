import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsTimeZone, IsUUID } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { IGetTimeLogReportInput, ITimesheet, ReportGroupFilterEnum } from '@gauzy/contracts';
import { parseToBoolean } from '@gauzy/utils';
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
