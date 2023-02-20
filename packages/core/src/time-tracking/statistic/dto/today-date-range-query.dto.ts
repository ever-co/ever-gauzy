import { ITimeLogTodayFilters } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";
import { IsBeforeDate } from "./../../../shared/validators";

export class TodayDateRangeQueryDTO implements ITimeLogTodayFilters {

    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    @IsDateString()
    @IsBeforeDate(TodayDateRangeQueryDTO, (it) => it.todayEnd, {
        message: "Today start date must be before to the today end date"
    })
    readonly todayStart: Date;

    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    @IsDateString()
    readonly todayEnd: Date;
}
