import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, IsUrl } from 'class-validator';
import { IPosthogConfig } from '@gauzy/contracts';
import { IsSecret } from '../../core/decorators';
import { Trimmed } from '../../shared/decorators/trim.decorator';

export class PosthogConfigDTO implements IPosthogConfig {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsSecret()
	@Trimmed()
	readonly posthog_api_key?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsUrl()
	@Trimmed()
	readonly posthog_api_host?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly posthog_enabled?: boolean;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly posthog_flush_interval?: number;
}
