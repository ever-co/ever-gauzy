import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ITimeLogTodayFilters } from '@gauzy/contracts';
import { IsBeforeDate } from './../../../shared/validators';

export class TodayDateRangeQueryDTO implements ITimeLogTodayFilters {
	/**
	 * The start of the date range for today's logs.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@IsBeforeDate(TodayDateRangeQueryDTO, (it) => it.todayEnd, {
		message: 'Today start date must be before today end date'
	})
	readonly todayStart: Date;

	/**
	 * The end of the date range for today's logs.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly todayEnd: Date;

	/**
	 * Time zone in IANA format (e.g., 'Europe/Warsaw')
	 */
	@ApiPropertyOptional({ example: 'Europe/Warsaw' })
	@IsOptional()
	@IsString()
	readonly timeZone?: string;
}
