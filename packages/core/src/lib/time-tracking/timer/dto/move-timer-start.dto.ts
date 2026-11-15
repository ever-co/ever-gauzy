import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ITimerStartMoveInput } from '@gauzy/contracts';
import { TIMER_START_REASON_MAX_LENGTH } from '../timer-start-move-rule';

/**
 * The body of `PUT /timesheet/timer/started-at`: the new start of the caller's running timer, and why it changes.
 */
export class MoveTimerStartDTO implements ITimerStartMoveInput {
	@ApiProperty({
		type: () => Date,
		example: '2026-11-16T09:00:00.000Z',
		description: 'The new start of the running timer, earlier or later. Not later than now.'
	})
	@IsNotEmpty()
	@Type(() => Date)
	@IsDate()
	readonly startedAt: Date;

	@ApiPropertyOptional({
		type: () => String,
		maxLength: TIMER_START_REASON_MAX_LENGTH,
		description: 'Why the tracked time changed. Required when the organization asks for a reason.'
	})
	@IsOptional()
	@IsString()
	@MaxLength(TIMER_START_REASON_MAX_LENGTH)
	readonly reason?: string;
}
