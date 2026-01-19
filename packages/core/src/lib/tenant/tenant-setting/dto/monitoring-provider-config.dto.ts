import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { IsSecret } from '../../../core/decorators';
import { Trimmed } from '../../../shared/decorators/trim.decorator';

/**
 * Monitoring Provider Configuration DTO validation
 * Used to mask secret values in monitoring settings (PostHog, Sentry, Jitsu)
 */
export class MonitoringProviderConfigDTO {
	// PostHog settings
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly posthogEnabled?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsSecret()
	@Trimmed()
	readonly posthogKey?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Trimmed()
	readonly posthogHost?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Trimmed()
	readonly posthogFlushInterval?: string;

	// Sentry settings
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly sentryEnabled?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsSecret()
	@Trimmed()
	readonly sentryDsn?: string;

	// Jitsu settings
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly jitsuEnabled?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Trimmed()
	readonly jitsuHost?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsSecret()
	@Trimmed()
	readonly jitsuWriteKey?: string;
}
