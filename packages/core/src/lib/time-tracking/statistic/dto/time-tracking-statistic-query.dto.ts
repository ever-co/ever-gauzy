import { ApiPropertyOptional, IntersectionType } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import { IsOptional } from "class-validator";
import { parseToBoolean } from "@gauzy/common";
import { ITimeLogFilters, ITimeLogTodayFilters } from "@gauzy/contracts";
import { FiltersQueryDTO, SelectorsQueryDTO } from "../../../shared/dto";
import { TodayDateRangeQueryDTO } from "./today-date-range-query.dto";

/**
 * Get statistic counts request DTO validation
 */
export class TimeTrackingStatisticQueryDTO extends IntersectionType(
    FiltersQueryDTO,
    IntersectionType(SelectorsQueryDTO, TodayDateRangeQueryDTO)
) implements ITimeLogFilters, ITimeLogTodayFilters {

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @Transform(({ value }: TransformFnParams) => value ? parseToBoolean(value) : false)
    readonly defaultRange: boolean = false;

    @ApiPropertyOptional({ type: () => String, example: 'week' })
    @IsOptional()
    readonly unitOfTime: moment.unitOfTime.Base = 'week';

    /**
     * Limit - max number of entities should be taken.
     */
    @ApiPropertyOptional({ type: () => Number })
    @IsOptional()
    @Transform(({ value }: TransformFnParams) => parseInt(value, 10))
    readonly take: number;
}
