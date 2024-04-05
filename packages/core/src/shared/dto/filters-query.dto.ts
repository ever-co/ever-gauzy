import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { ITimeLogFilters, TimeLogSourceEnum, TimeLogType } from "@gauzy/contracts";
import { IsBetweenActivty } from "./../../shared/validators";

/**
 * Get filters common request DTO validation
 */
export class FiltersQueryDTO implements ITimeLogFilters {

    @ApiPropertyOptional({ enum: TimeLogSourceEnum })
    @IsOptional()
    @IsEnum(TimeLogSourceEnum, { each: true })
    readonly source: TimeLogSourceEnum[];

    @ApiPropertyOptional({ enum: TimeLogType })
    @IsOptional()
    @IsEnum(TimeLogType, { each: true })
    readonly logType: TimeLogType[];

    @ApiPropertyOptional({ type: () => 'object' })
    @IsOptional()
    @IsBetweenActivty(FiltersQueryDTO, (it) => it.activityLevel)
    readonly activityLevel: {
        start: number;
        end: number;
    };
}
