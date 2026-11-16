import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsBoolean, IsDate, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, ITimeLogSplitInput } from '@gauzy/contracts';

/** An instant in ISO 8601 with its offset (`Z` or `±hh:mm`): the date, the time to the minute or finer, the offset. */
const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * The moment a split names, read only from an ISO 8601 instant with its offset and a day the calendar has. Anything
 * else is left as it came, which `@IsDate()` refuses: a time without an offset would be read in the server's own time
 * zone, a day past the month's end would roll over into the next month, and a number is no moment the caller wrote.
 *
 * @param params - The value sent.
 * @returns The moment, or the value as it came.
 */
export function strictSplitInstant({ value }: TransformFnParams): unknown {
	if (typeof value !== 'string') {
		return value;
	}
	const match = ISO_INSTANT.exec(value);
	if (!match) {
		return value;
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const calendarDay = new Date(Date.UTC(year, month - 1, day));
	const keepsYear = calendarDay.getUTCFullYear() === year;
	const keepsMonth = calendarDay.getUTCMonth() === month - 1;
	const keepsDay = calendarDay.getUTCDate() === day;
	const isCalendarDay = keepsYear && keepsMonth && keepsDay;
	if (!isCalendarDay) {
		return value;
	}
	return new Date(value);
}

/**
 * The body of `POST /timesheet/time-log/:id/split`: where the log is split, and what its second part changes. Every
 * field is declared, as the route validates with `whitelist: true`; a field left out keeps the log's value, and `null`
 * clears the task or the project of the second part.
 */
export class SplitTimeLogDTO implements ITimeLogSplitInput {
	/** Where the log is split: an ISO 8601 instant with its offset inside it, on a slot boundary for tracked time. */
	@ApiProperty({ type: () => Date })
	@IsNotEmpty()
	@Transform(strictSplitInstant)
	@IsDate()
	readonly splitAt: Date;

	@ApiPropertyOptional({ type: () => String, nullable: true })
	@IsOptional()
	@IsUUID()
	readonly taskId?: ID | null;

	@ApiPropertyOptional({ type: () => String, nullable: true })
	@IsOptional()
	@IsUUID()
	readonly projectId?: ID | null;

	@ApiPropertyOptional({ type: () => String, nullable: true })
	@IsOptional()
	@IsString()
	readonly description?: string | null;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isBillable?: boolean;

	/** Why the time changes, kept in both parts' history. */
	@ApiPropertyOptional({ type: () => String, nullable: true })
	@IsOptional()
	@IsString()
	readonly reason?: string | null;
}
