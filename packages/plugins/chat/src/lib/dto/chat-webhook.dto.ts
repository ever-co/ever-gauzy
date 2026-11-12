import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { CHAT_WEBHOOK_NAME_MAX_LENGTH, IChatInteractionInput, IChatWebhookCreateInput, IChatWebhookUpdateInput } from '@gauzy/contracts';

export class ChatWebhookCreateDTO implements IChatWebhookCreateInput {
	@ApiProperty({ type: () => String, maxLength: CHAT_WEBHOOK_NAME_MAX_LENGTH })
	@IsString()
	@MinLength(1)
	@MaxLength(CHAT_WEBHOOK_NAME_MAX_LENGTH)
	name!: string;

	@ApiPropertyOptional({ type: () => String, nullable: true, description: 'An https URL of a public host, shown beside the posts.' })
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@IsString()
	@MaxLength(2048)
	iconUrl?: string | null;

	@ApiPropertyOptional({ type: () => String, nullable: true, description: 'Where button clicks are posted (signed); https, public hosts only.' })
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@IsString()
	@MaxLength(2048)
	interactionUrl?: string | null;

	@ApiPropertyOptional({ type: () => Boolean, description: 'Whether @channel / @here in its posts notify the channel.' })
	@IsOptional()
	@IsBoolean()
	canBroadcast?: boolean;
}

export class ChatWebhookUpdateDTO implements IChatWebhookUpdateInput {
	@ApiPropertyOptional({ type: () => String, maxLength: CHAT_WEBHOOK_NAME_MAX_LENGTH })
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(CHAT_WEBHOOK_NAME_MAX_LENGTH)
	name?: string;

	@ApiPropertyOptional({ type: () => String, nullable: true, description: '`null` clears it.' })
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@IsString()
	@MaxLength(2048)
	iconUrl?: string | null;

	@ApiPropertyOptional({ type: () => String, nullable: true, description: '`null` clears it.' })
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@IsString()
	@MaxLength(2048)
	interactionUrl?: string | null;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	canBroadcast?: boolean;
}

export class ChatInteractionDTO implements IChatInteractionInput {
	@ApiProperty({ type: () => String, description: 'The action id of the button clicked.' })
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	actionId!: string;

	@ApiPropertyOptional({ type: () => String, description: 'The actions block of the button, when two blocks reuse an action id.' })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	blockId?: string;
}
