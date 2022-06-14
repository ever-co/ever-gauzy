import { ITimeLogFilters, TimeLogSourceEnum, TimeLogType } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, Max, Min } from "class-validator";

/**
 * Get filters common request DTO validation
 */
export class FiltersQueryDTO implements ITimeLogFilters {

    @ApiPropertyOptional({ type: () => String, enum: TimeLogSourceEnum })
    @IsOptional()
    @IsEnum(TimeLogSourceEnum)
    readonly source: TimeLogSourceEnum[];

    @ApiPropertyOptional({ type: () => String, enum: TimeLogType })
    @IsOptional()
    @IsEnum(TimeLogType)
    readonly logType: TimeLogType[];

    @ApiPropertyOptional({ type: () => String, enum: TimeLogType })
    @IsOptional()
    @Min(0)
    @Max(100)
    readonly activityLevel: {
        start: number;
        end: number;
    };
}