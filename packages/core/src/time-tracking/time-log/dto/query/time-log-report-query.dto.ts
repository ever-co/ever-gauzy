import { IGetTimeLogReportInput, ReportGroupFilterEnum } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsEnum, IsOptional } from "class-validator";
import { FiltersQueryDTO, SelectorsQueryDTO } from "./../../../../shared/dto";

/**
 * Get time log request DTO validation
 */
export class TimeLogReportQueryDTO extends IntersectionType(
    FiltersQueryDTO,
    SelectorsQueryDTO
) implements IGetTimeLogReportInput {
    
    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsEnum(ReportGroupFilterEnum)
    readonly groupBy: ReportGroupFilterEnum;

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    readonly relations: string[];
}