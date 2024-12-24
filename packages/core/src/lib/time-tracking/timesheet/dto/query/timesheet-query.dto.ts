import { IGetTimesheetInput } from '@gauzy/contracts';
import { IntersectionType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsArray } from 'class-validator';
import { TimesheetStatus } from '@gauzy/contracts';
import { RelationsQueryDTO, SelectorsQueryDTO } from './../../../../shared/dto';

/**
 * Get timesheet request DTO validation
 */
export class TimesheetQueryDTO
	extends IntersectionType(RelationsQueryDTO, SelectorsQueryDTO)
	implements IGetTimesheetInput
{
	/**
	 * An array of status  to filter the time logs by specific status.
	 * If not provided, no filtering by status will be applied.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	status: TimesheetStatus[];
}
