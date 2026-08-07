import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

/**
 * A single chat-user → Gauzy employee mapping.
 *
 * Mirrors one entry of `[connectors.gauzy.user_map]` in the Ever Async
 * connector config (`everasync.toml`): the Ever Async connector maps the chat
 * message author's platform user id (Slack/Discord) to a Gauzy employee id
 * before querying that employee's tasks.
 */
export class EverAsyncUserMappingDto {
	@ApiProperty({
		description: 'Chat platform user id (e.g. a Slack member id)',
		example: 'U0123ABC'
	})
	@IsNotEmpty()
	@IsString()
	readonly chatUserId!: string;

	@ApiProperty({
		description: 'Gauzy employee id the chat user maps to',
		example: 'b1f2c3d4-0000-0000-0000-000000000000'
	})
	@IsNotEmpty()
	@IsUUID()
	readonly employeeId!: string;
}
