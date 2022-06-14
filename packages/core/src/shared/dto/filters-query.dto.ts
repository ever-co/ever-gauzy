import { ITimeLogFilters, TimeLogSourceEnum, TimeLogType } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { IsBetweenActivty } from "./../../shared/decorators/validations";

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
    @IsBetweenActivty(FiltersQueryDTO, (it) => it.activityLevel)
    readonly activityLevel: {
        start: number;
        end: number;
    };
}