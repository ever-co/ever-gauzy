import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import {
	ID,
	IRealtimeCatchUpQuery,
	IRealtimePresenceInput,
	IRealtimeTypingInput,
	REALTIME_MAX_TYPING_RECIPIENTS,
	RealtimePresenceStatus
} from '@gauzy/contracts';
import { REALTIME_CATCH_UP_MAX } from '../realtime.constants';

/** Body of `POST /realtime/presence`. */
export class RealtimePresenceDTO implements IRealtimePresenceInput {
	@ApiProperty({ enum: RealtimePresenceStatus })
	@IsEnum(RealtimePresenceStatus)
	status!: RealtimePresenceStatus;

	@ApiPropertyOptional({
		type: () => String,
		maxLength: 64,
		description:
			'The id this client gave its connection (one per tab or device; letters, digits, `-` and `_`). Each connection reports for itself and the employee is as present as their most present connection; send it at least every minute, or it lapses after 150 s. Without it, every tab of the employee shares one connection and the last report wins.'
	})
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@Matches(/^[\w-]+$/)
	connectionId?: string;
}

/** Body of `POST /realtime/typing`. */
export class RealtimeTypingDTO implements IRealtimeTypingInput {
	@ApiProperty({ type: () => String })
	@IsUUID()
	conversationId!: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	threadRootId?: ID;

	@ApiProperty({ type: () => [String], description: 'The users to tell; at most 50.' })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(REALTIME_MAX_TYPING_RECIPIENTS)
	@IsUUID('all', { each: true })
	recipientUserIds!: ID[];
}

/** Query of `GET /realtime/events`. */
export class RealtimeCatchUpQueryDTO implements IRealtimeCatchUpQuery {
	@ApiPropertyOptional({ type: () => Number, description: 'Epoch ms of the newest event already applied.' })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	after?: number;

	@ApiPropertyOptional({ type: () => String, description: 'The eventId of the newest event already applied (the previous answer\'s cursorId).' })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	afterId?: string;

	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: REALTIME_CATCH_UP_MAX })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(REALTIME_CATCH_UP_MAX)
	limit?: number;
}
