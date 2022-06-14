import { IGetTimeLogReportInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { DateRangeQueryDTO, FiltersQueryDTO } from "./../../../../shared/dto";

/**
 * Get time log request DTO validation
 */
export class TimeLogReportQueryDTO extends IntersectionType(
    FiltersQueryDTO,
    DateRangeQueryDTO
) implements IGetTimeLogReportInput {

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    readonly employeeIds: string[];

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    readonly projectIds: string[];
}