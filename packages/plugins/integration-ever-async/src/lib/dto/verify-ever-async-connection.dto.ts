import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

/**
 * DTO for verifying connectivity to an Ever Async server.
 *
 * `serverUrl` is optional: when omitted, the stored
 * `EVER_ASYNC_SERVER_URL` setting for the current tenant is used, so the UI can
 * test either a not-yet-saved URL (connect wizard) or the saved configuration.
 */
export class VerifyEverAsyncConnectionDto {
	@ApiPropertyOptional({
		description: 'Ever Async server base URL to verify (defaults to the stored setting)',
		example: 'https://async.example.com'
	})
	@IsOptional()
	@IsString()
	@IsUrl({ require_tld: false, require_protocol: true })
	readonly serverUrl?: string;
}
