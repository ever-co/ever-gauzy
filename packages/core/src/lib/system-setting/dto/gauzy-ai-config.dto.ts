import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl } from 'class-validator';
import { IGauzyAIConfig } from '@gauzy/contracts';
import { IsSecret } from '../../core/decorators';
import { Trimmed } from '../../shared/decorators/trim.decorator';

export class GauzyAIConfigDTO implements IGauzyAIConfig {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsUrl()
	@Trimmed()
	readonly gauzy_ai_graphql_endpoint?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsUrl()
	@Trimmed()
	readonly gauzy_ai_rest_endpoint?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsSecret()
	@Trimmed()
	readonly gauzy_ai_api_key?: string;
}
