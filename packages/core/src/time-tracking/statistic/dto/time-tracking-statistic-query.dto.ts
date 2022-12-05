import { ITimeLogFilters } from "@gauzy/contracts";
import { ApiPropertyOptional, IntersectionType } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { FiltersQueryDTO, SelectorsQueryDTO } from "../../../shared/dto";

/**
 * Get statistic counts request DTO validation
 */
export class TimeTrackingStatisticQueryDTO extends IntersectionType(
    FiltersQueryDTO,
    SelectorsQueryDTO
) implements ITimeLogFilters {

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
    @IsOptional()
    readonly defaultRange: boolean = true;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    readonly unitOfTime: moment.unitOfTime.Base = "week";
}