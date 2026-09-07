import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';
import { IAiProviderCredentialCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * DTO for creating (or upserting) a per-tenant BYOK AI provider credential.
 * The `apiKey` is write-only: it is encrypted before storage and never
 * returned in full by any read endpoint.
 *
 * `apiKey` is OPTIONAL at the DTO level: providers that advertise `requiresApiKey: false` (local
 * speech servers, self-hosted OpenAI-compatible endpoints) may be saved with only a base URL. The
 * service enforces "key required" per provider definition, so a cloud provider still gets a 400.
 */
export class CreateAiProviderCredentialDTO extends TenantOrganizationBaseDTO implements IAiProviderCredentialCreateInput {
	@ApiProperty({ type: () => String, description: 'AI provider identifier (e.g. anthropic, openai)' })
	@IsNotEmpty({ message: 'Provider id is required' })
	@IsString({ message: 'Provider id must be a string' })
	@Matches(/^[a-z0-9][a-z0-9._-]*$/i, {
		message: 'Provider id can only contain letters, numbers, dots, underscores, and hyphens'
	})
	providerId: string;

	@ApiPropertyOptional({
		type: () => String,
		description:
			'Secret API key (write-only; stored encrypted). Required unless the provider runs without one (local servers).'
	})
	@IsOptional()
	@IsString({ message: 'API key must be a string' })
	@Length(1, 2048, { message: 'API key must be between 1 and 2048 characters' })
	apiKey?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Custom base URL for the provider API' })
	@IsOptional()
	@IsUrl(
		{ protocols: ['http', 'https'], require_protocol: true, require_tld: false },
		{ message: 'Base URL must be a valid HTTP or HTTPS URL' }
	)
	baseUrl?: string;

	@ApiPropertyOptional({ type: () => Boolean, description: 'Whether this credential is active', default: true })
	@IsOptional()
	@IsBoolean({ message: 'Enabled must be a boolean' })
	enabled: boolean;

	@ApiPropertyOptional({
		type: () => Boolean,
		description: "Whether this provider is the tenant's default for chat",
		default: false
	})
	@IsOptional()
	@IsBoolean({ message: 'Is default must be a boolean' })
	isDefault?: boolean;

	@ApiPropertyOptional({
		type: () => String,
		nullable: true,
		description: 'Preferred default model id (e.g. claude-sonnet-5); null clears the stored model'
	})
	@IsOptional() // `null` (= clear) passes: IsOptional skips the validators below for null/undefined
	@IsString({ message: 'Default model must be a string' })
	@Length(1, 255, { message: 'Default model must be between 1 and 255 characters' })
	defaultModel?: string | null;

	@ApiPropertyOptional({
		type: () => Boolean,
		description: "Whether this provider is the tenant's default voice (dictation) provider",
		default: false
	})
	@IsOptional()
	@IsBoolean({ message: 'Is voice default must be a boolean' })
	isVoiceDefault?: boolean;

	@ApiPropertyOptional({
		type: () => String,
		nullable: true,
		description: 'Preferred speech-to-text model id (e.g. whisper-1); null clears the stored model'
	})
	@IsOptional() // `null` (= clear) passes: IsOptional skips the validators below for null/undefined
	@IsString({ message: 'Speech model must be a string' })
	@Length(1, 255, { message: 'Speech model must be between 1 and 255 characters' })
	speechModel?: string | null;
}
