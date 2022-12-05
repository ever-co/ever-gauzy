import { ITimeLogFilters } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional } from "class-validator";
import { DateRangeQueryDTO } from "./date-range-query.dto";

/**
 * Get selectors common request DTO validation
 */
export class SelectorsQueryDTO extends DateRangeQueryDTO implements ITimeLogFilters {

    @ApiPropertyOptional({ type: () => Array, isArray: true, readOnly: true })
    @IsOptional()
    @IsArray()
    readonly employeeIds: string[];

    @ApiPropertyOptional({ type: () => Array, isArray: true, readOnly: true })
    @IsOptional()
    @IsArray()
    readonly projectIds: string[];

    @ApiPropertyOptional({ type: () => Array, isArray: true, readOnly: true })
    @IsOptional()
    @IsArray()
    readonly taskIds: string[];
}