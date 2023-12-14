import { ApiPropertyOptional, IntersectionType } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsTimeZone, IsUUID } from "class-validator";
import * as moment from 'moment';
import { IGetTimeLogReportInput, ITimesheet, ReportGroupFilterEnum } from "@gauzy/contracts";
import { FiltersQueryDTO, RelationsQueryDTO, SelectorsQueryDTO } from "../../../../shared/dto";

/**
 * Get time log request DTO validation
 */
export class TimeLogQueryDTO extends IntersectionType(
    FiltersQueryDTO,
    IntersectionType(SelectorsQueryDTO, RelationsQueryDTO)
) implements IGetTimeLogReportInput {

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
    readonly timezone: string = moment.tz.guess();
}
