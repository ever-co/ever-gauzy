import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsArray } from 'class-validator';
import { ITimeLogFilters } from '@gauzy/contracts';
import { DateRangeQueryDTO } from './date-range-query.dto';

/**
 * Get selectors common request DTO validation.
 * Extends DateRangeQueryDTO to include date range filters.
 */
export class SelectorsQueryDTO extends DateRangeQueryDTO implements ITimeLogFilters {

    /**
     * An array of employee IDs for filtering time logs.
     */
    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    readonly employeeIds: string[];

    /**
     * An array of project IDs for filtering time logs.
     */
    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    readonly projectIds: string[];

    /**
     * An array of task IDs for filtering time logs.
     */
    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    readonly taskIds: string[];

    /**
     * An array of team IDs for filtering time logs.
     */
    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    readonly teamIds: string[];
}
