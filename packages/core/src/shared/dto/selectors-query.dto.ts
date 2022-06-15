import { ITimeLogFilters } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { DateRangeQueryDTO } from "./date-range-query.dto";

/**
 * Get selectors common request DTO validation
 */
export class SelectorsQueryDTO extends DateRangeQueryDTO implements ITimeLogFilters {

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    readonly employeeIds: string[];

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    readonly projectIds: string[];
}