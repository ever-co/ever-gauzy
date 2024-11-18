import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsArray, IsString } from 'class-validator';
import { ID, ITimeLogFilters, TimesheetStatus } from '@gauzy/contracts';
import { DateRangeQueryDTO } from './date-range-query.dto';

/**
 * Data Transfer Object for filtering time logs by various selectors.
 * Extends DateRangeQueryDTO to include date range filters alongside employee, project, task, and team selectors.
 */
export class SelectorsQueryDTO extends DateRangeQueryDTO implements ITimeLogFilters {
	/**
	 * An array of employee IDs to filter the time logs by specific employees.
	 * If not provided, no filtering by employee will be applied.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	employeeIds: ID[];

	/**
	 * An array of project IDs to filter the time logs by specific projects.
	 * If not provided, no filtering by project will be applied.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	projectIds: ID[];

	/**
	 * An array of task IDs to filter the time logs by specific tasks.
	 * If not provided, no filtering by task will be applied.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	taskIds: ID[];

	/**
	 * An array of team IDs to filter the time logs by specific teams.
	 * If not provided, no filtering by team will be applied.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	teamIds: ID[];

	/**
	 * An array of status  to filter the time logs by specific status.
	 * If not provided, no filtering by status will be applied.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	status: TimesheetStatus[];
}
