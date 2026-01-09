import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { IChatwootConfig } from '@gauzy/contracts';
import { IsSecret } from '../../core/decorators';
import { Trimmed } from '../../shared/decorators/trim.decorator';

export class ChatwootConfigDTO implements IChatwootConfig {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsSecret()
	@Trimmed()
	readonly chatwoot_sdk_token?: string;
}
