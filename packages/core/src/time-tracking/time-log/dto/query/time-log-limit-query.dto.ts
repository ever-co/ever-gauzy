import { IGetTimeLogReportInput } from "@gauzy/contracts";
import { ApiPropertyOptional, OmitType } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { TimeLogQueryDTO } from "./time-log-query.dto";

/**
 * Get time log daily/weekly limit request DTO validation
 */
export class TimeLogLimitQueryDTO extends OmitType(TimeLogQueryDTO, ['timesheetId']) implements IGetTimeLogReportInput {

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    readonly duration: 'day' | 'week' | 'month';
}
