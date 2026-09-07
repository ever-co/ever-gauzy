import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';
import { IAiProviderCredential } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmAiProviderCredentialRepository } from './repositories/mikro-orm-ai-provider-credential.repository';

/**
 * Per-tenant BYOK ("bring your own key") credential for an AI provider.
 *
 * One row per (tenant, provider). The `apiKey` column stores the secret
 * ENCRYPTED at rest (AES-256-GCM keyed by the base64 `ENCRYPTION_KEY`
 * environment variable — the same mechanism as the core
 * `EncryptionService`). Encryption/decryption happens in
 * {@link AiProviderCredentialService}; the raw column value is never a
 * plaintext key and is excluded from serialized responses.
 */
@MultiORMEntity('ai_provider_credential', { mikroOrmRepository: () => MikroOrmAiProviderCredentialRepository })
export class AiProviderCredential extends TenantOrganizationBaseEntity implements IAiProviderCredential {
	/**
	 * Provider identifier (see `AiProviderEnum` — e.g. 'anthropic', 'openai').
	 * Providers registered by `@gauzy/plugin-ai-provider-*` plugins may use
	 * ids outside the enum, so this is stored as a plain string.
	 */
	@ApiProperty({ type: () => String, description: 'AI provider identifier (e.g. anthropic, openai)' })
	@IsNotEmpty({ message: 'Provider id is required' })
	@IsString({ message: 'Provider id must be a string' })
	@Matches(/^[a-z0-9][a-z0-9._-]*$/i, {
		message: 'Provider id can only contain letters, numbers, dots, underscores, and hyphens'
	})
	@ColumnIndex()
	@MultiORMColumn()
	providerId: string;

	/**
	 * Secret API key — stored ENCRYPTED (format `{ivHex}:{authTagHex}:{cipherHex}`,
	 * AES-256-GCM with the `ENCRYPTION_KEY` env secret). Never returned by read
	 * endpoints; list responses expose only a masked hint ('••••' + last 4).
	 */
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ type: 'text', nullable: true })
	apiKey?: string;

	/**
	 * Optional custom base URL (e.g. a self-hosted OpenAI/OpenRouter-compatible endpoint).
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Custom base URL for the provider API' })
	@IsOptional()
	@IsUrl(
		{ protocols: ['http', 'https'], require_protocol: true, require_tld: false },
		{ message: 'Base URL must be a valid HTTP or HTTPS URL' }
	)
	@MultiORMColumn({ nullable: true })
	baseUrl?: string;

	/**
	 * Whether this credential is active. Disabled credentials are ignored by
	 * the chat engine (the provider falls back to server environment keys).
	 */
	@ApiProperty({ type: () => Boolean, description: 'Whether this credential is active', default: true })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: true })
	enabled: boolean;

	/**
	 * Whether this provider is the tenant's default for chat.
	 * At most one credential per tenant has `isDefault = true`.
	 */
	@ApiPropertyOptional({ type: () => Boolean, description: "Whether this provider is the tenant's default", default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	isDefault?: boolean;

	/**
	 * Preferred default model for this provider (overrides the provider's own default).
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Preferred default model id (e.g. claude-sonnet-5)' })
	@IsOptional()
	@IsString({ message: 'Default model must be a string' })
	@Length(1, 255, { message: 'Default model must be between 1 and 255 characters' })
	@MultiORMColumn({ nullable: true })
	defaultModel?: string;

	/**
	 * Whether this provider is the tenant's default for VOICE (dictation / speech-to-text).
	 * Independent of `isDefault` (chat). At most one credential per tenant has `isVoiceDefault = true`.
	 */
	@ApiPropertyOptional({
		type: () => Boolean,
		description: "Whether this provider is the tenant's default voice (dictation) provider",
		default: false
	})
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	isVoiceDefault?: boolean;

	/**
	 * Preferred speech-to-text model for this provider (overrides the provider's own speech default).
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Preferred speech-to-text model id (e.g. whisper-1)' })
	@IsOptional()
	@IsString({ message: 'Speech model must be a string' })
	@Length(1, 255, { message: 'Speech model must be between 1 and 255 characters' })
	@MultiORMColumn({ nullable: true })
	speechModel?: string;
}
