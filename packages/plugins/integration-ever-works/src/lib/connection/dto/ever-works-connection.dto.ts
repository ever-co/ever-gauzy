import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/**
 * An Ever Works integration key: `ew_int_` and an opaque token. Personal keys (`ew_live_…`) act as
 * their user with every right and are refused (plan 02 §2).
 */
export const EVER_WORKS_INTEGRATION_KEY_PATTERN = /^ew_int_[A-Za-z0-9_-]{16,256}$/;

export class EverWorksKeyDto {
	@ApiProperty({ description: 'Ever Works integration key (starts with ew_int_). Write-only: never returned.', writeOnly: true })
	@IsNotEmpty()
	@IsString()
	@MaxLength(300)
	@Matches(EVER_WORKS_INTEGRATION_KEY_PATTERN, {
		message: 'Paste an Ever Works integration key (it starts with ew_int_); personal API keys are not accepted.'
	})
	readonly apiKey!: string;
}

export class EverWorksConnectDto extends EverWorksKeyDto {
	@ApiProperty({ description: 'Ever Works API base URL (public HTTPS, no query or fragment).', example: 'https://api.example.com/api' })
	@IsNotEmpty()
	@IsString()
	@MaxLength(2048)
	readonly apiBaseUrl!: string;
}
