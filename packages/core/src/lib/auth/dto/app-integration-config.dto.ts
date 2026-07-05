import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { IAppIntegrationConfig } from '@gauzy/common';

/**
 * DTO mirroring {@link IAppIntegrationConfig}.
 *
 * Used to give the `POST /auth/email/verify/resend-link` endpoint a concrete, decorated class so
 * `@UseValidationPipe({ whitelist: true })` strips any unexpected body keys (including prototype
 * pollution vectors such as `__proto__`) before the body reaches `deepMerge`.
 */
export class AppIntegrationConfigDTO implements IAppIntegrationConfig {
	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	readonly appName?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	readonly appLogo?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	readonly appSignature?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	readonly appLink?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	readonly appEmailConfirmationUrl?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	readonly appMagicSignUrl?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	readonly companyLink?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	readonly companyName?: string;
}
