import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsArray } from 'class-validator';
import { ID, ITimeLogFilters } from '@gauzy/contracts';
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
	employeeIds: ID[];

	/**
	 * An array of project IDs for filtering time logs.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	projectIds: ID[];

	/**
	 * An array of task IDs for filtering time logs.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	taskIds: ID[];

	/**
	 * An array of team IDs for filtering time logs.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	teamIds: ID[];
}
