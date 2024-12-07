import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { ITimeLogFilters, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { IsBetweenActivity } from './../../shared/validators';

/**
 * Data Transfer Object for filtering time logs based on source, log type, and activity level.
 * This DTO provides optional filters to refine time log queries.
 */
export class FiltersQueryDTO implements ITimeLogFilters {
	/**
	 * Filters time logs by their source.
	 * Can include multiple sources like Desktop, Web, or Mobile.
	 * If not provided, no filtering by source will be applied.
	 */
	@ApiPropertyOptional({ enum: TimeLogSourceEnum })
	@IsOptional()
	@IsEnum(TimeLogSourceEnum, { each: true })
	source: TimeLogSourceEnum[];

	/**
	 * Filters time logs by their log type (Manual, Tracked, etc.).
	 * Multiple log types can be specified.
	 * If not provided, no filtering by log type will be applied.
	 */
	@ApiPropertyOptional({ enum: TimeLogType })
	@IsOptional()
	@IsEnum(TimeLogType, { each: true })
	logType: TimeLogType[];

	/**
	 * Filters time logs by activity level, specifying a range between `start` and `end`.
	 * This filter limits logs to a specific activity range (e.g., from 10% to 90% activity).
	 * If not provided, no filtering by activity level will be applied.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsBetweenActivity(FiltersQueryDTO, (it) => it.activityLevel)
	@Type(() => Object)
	activityLevel: {
		start: number;
		end: number;
	};
}
