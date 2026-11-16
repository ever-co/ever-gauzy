import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, ITimeLogSplitInput } from '@gauzy/contracts';

/**
 * The body of `POST /timesheet/time-log/:id/split`: where the log is split, and what its second part changes. Every
 * field is declared, as the route validates with `whitelist: true`; a field left out keeps the log's value, and `null`
 * clears the task or the project of the second part.
 */
export class SplitTimeLogDTO implements ITimeLogSplitInput {
	/** Where the log is split: a moment inside it, on a slot boundary for tracked time. */
	@ApiProperty({ type: () => Date })
	@IsNotEmpty()
	@Type(() => Date)
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
