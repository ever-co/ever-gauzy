import { ITimeLogFilters } from "@gauzy/contracts";
import { ApiPropertyOptional, IntersectionType } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import { IsOptional } from "class-validator";
import { FiltersQueryDTO, SelectorsQueryDTO } from "../../../shared/dto";

/**
 * Get statistic counts request DTO validation
 */
export class TimeTrackingStatisticQueryDTO extends IntersectionType(
    FiltersQueryDTO,
    SelectorsQueryDTO
) implements ITimeLogFilters {

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @Transform(({ value }: TransformFnParams) => ((value) ? (typeof value === 'string' ? Boolean(JSON.parse(value)) : value) : true))
    readonly defaultRange: boolean = true;

    @ApiPropertyOptional({ type: () => String, example: 'week' })
    @IsOptional()
    readonly unitOfTime: moment.unitOfTime.Base = 'week';
}