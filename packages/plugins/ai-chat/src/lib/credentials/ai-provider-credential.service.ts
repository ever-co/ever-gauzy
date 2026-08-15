import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import {
	ID,
	IAiProviderCredential,
	IAiProviderCredentialCreateInput,
	IAiProviderCredentialUpdateInput,
	IPagination
} from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { AiProviderRegistry } from '../provider-registry';
import { AiProviderCredential } from './ai-provider-credential.entity';
import { AiProviderCredentialEncryptionService } from './ai-provider-credential-encryption.service';
import { MikroOrmAiProviderCredentialRepository } from './repositories/mikro-orm-ai-provider-credential.repository';
import { TypeOrmAiProviderCredentialRepository } from './repositories/type-orm-ai-provider-credential.repository';

/** OpenRouter's PKCE code→key exchange endpoint (see https://openrouter.ai/docs/use-cases/oauth-pke). */
const OPENROUTER_KEY_EXCHANGE_URL = 'https://openrouter.ai/api/v1/auth/keys';

/** Mask prefix used in place of the encrypted API key on read endpoints. */
const API_KEY_MASK_PREFIX = '••••';

/**
 * AiProviderCredentialService
 *
 * CRUD + secret handling for per-tenant BYOK AI provider credentials.
 * API keys are encrypted at rest with AES-256-GCM keyed by the base64
 * `ENCRYPTION_KEY` environment variable (see
 * {@link AiProviderCredentialEncryptionService}) and are only ever returned
 * decrypted to the server-side chat engine — read endpoints receive a
 * masked hint (`'••••' + last 4 characters`).
 */
@Injectable()
export class AiProviderCredentialService extends TenantAwareCrudService<AiProviderCredential> {
	private readonly logger = new Logger(AiProviderCredentialService.name);

	constructor(
		public readonly typeOrmAiProviderCredentialRepository: TypeOrmAiProviderCredentialRepository,
		public readonly mikroOrmAiProviderCredentialRepository: MikroOrmAiProviderCredentialRepository,
		private readonly encryptionService: AiProviderCredentialEncryptionService
	) {
		super(typeOrmAiProviderCredentialRepository, mikroOrmAiProviderCredentialRepository);
	}

	/**
	 * Resolve a tenant's usable credential for a provider, with the API key decrypted.
	 * Intended for the server-side chat engine only — never expose the result to clients.
	 *
	 * @param providerId - The AI provider identifier (e.g. 'anthropic').
	 * @param tenantId - The tenant to resolve the credential for.
	 * @returns The decrypted credential, or `null` when no credential exists,
	 *          the credential is disabled, or the stored key cannot be decrypted.
	 */
	async getDecryptedCredential(
		providerId: string,
		tenantId: string
	): Promise<{
		apiKey: string;
		baseUrl?: string;
		defaultModel?: string;
		speechModel?: string;
		enabled: boolean;
		isDefault: boolean;
		isVoiceDefault: boolean;
	} | null> {
		const { success, record } = await this.findOneOrFailByOptions({
			where: { providerId, tenantId } as FindOptionsWhere<AiProviderCredential>
		});

		if (!success || !record || !record.enabled) {
			return null;
		}

		// A row without a key is only usable for providers that run without one (local servers): the
		// row then contributes its base URL and preferences and the resolver marks it configured with an
		// EMPTY key. For every other provider a key-less row is as good as none.
		if (!record.apiKey) {
			const definition = AiProviderRegistry.get(providerId);
			if (definition?.requiresApiKey !== false) {
				return null;
			}
			return {
				apiKey: '',
				baseUrl: record.baseUrl ?? undefined,
				defaultModel: record.defaultModel ?? undefined,
				speechModel: record.speechModel ?? undefined,
				enabled: record.enabled,
				isDefault: !!record.isDefault,
				isVoiceDefault: !!record.isVoiceDefault
			};
		}

		let apiKey: string;
		try {
			apiKey = this.encryptionService.decrypt(record.apiKey);
		} catch (error) {
			this.logger.warn(
				`Failed to decrypt API key for provider '${providerId}' (tenant '${tenantId}'). ` +
					`Was ENCRYPTION_KEY changed? ${error instanceof Error ? error.message : error}`
			);
			return null;
		}

		return {
			apiKey,
			baseUrl: record.baseUrl ?? undefined,
			defaultModel: record.defaultModel ?? undefined,
			speechModel: record.speechModel ?? undefined,
			enabled: record.enabled,
			isDefault: !!record.isDefault,
			isVoiceDefault: !!record.isVoiceDefault
		};
	}

	/**
	 * Resolve the tenant's default provider — the enabled credential flagged `isDefault`.
	 *
	 * @param tenantId - The tenant to resolve the default for.
	 * @returns The default provider id (and its preferred model, when set), or `null`.
	 */
	async getTenantDefault(tenantId: string): Promise<{ providerId: string; defaultModel?: string } | null> {
		const { success, record } = await this.findOneOrFailByOptions({
			where: { tenantId, enabled: true, isDefault: true } as FindOptionsWhere<AiProviderCredential>
		});

		if (!success || !record) {
			return null;
		}

		return {
			providerId: record.providerId,
			...(record.defaultModel ? { defaultModel: record.defaultModel } : {})
		};
	}

	/**
	 * Resolve the tenant's default VOICE (dictation) provider — the enabled credential flagged
	 * `isVoiceDefault`.
	 *
	 * @param tenantId - The tenant to resolve the voice default for.
	 * @returns The voice-default provider id (and its preferred speech model, when set), or `null`.
	 */
	async getTenantVoiceDefault(tenantId: string): Promise<{ providerId: string; speechModel?: string } | null> {
		const { success, record } = await this.findOneOrFailByOptions({
			where: { tenantId, enabled: true, isVoiceDefault: true } as FindOptionsWhere<AiProviderCredential>
		});

		if (!success || !record) {
			return null;
		}

		return {
			providerId: record.providerId,
			...(record.speechModel ? { speechModel: record.speechModel } : {})
		};
	}

	/**
	 * Complete a provider "Connect" flow: exchange the PKCE authorization
	 * `code` + `codeVerifier` for an API key server-side and store it as the
	 * tenant's BYOK credential for that provider. The key never touches the
	 * browser. Currently supports OpenRouter's PKCE flow only.
	 *
	 * @param input - Provider id + the PKCE code and verifier from the callback.
	 * @returns The persisted credential with a masked API key.
	 */
	async connectExchange(input: {
		providerId: string;
		code: string;
		codeVerifier: string;
		organizationId?: ID;
	}): Promise<IAiProviderCredential> {
		const providerId = input.providerId?.trim().toLowerCase();
		const definition = AiProviderRegistry.get(providerId);
		if (!definition) {
			throw new BadRequestException(`Unknown AI provider '${providerId}'.`);
		}
		if (definition.connect?.type !== 'openrouter-pkce') {
			throw new BadRequestException(`Provider '${providerId}' does not support a Connect flow.`);
		}

		let response: Response;
		try {
			response = await fetch(OPENROUTER_KEY_EXCHANGE_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					code: input.code,
					code_verifier: input.codeVerifier,
					code_challenge_method: 'S256'
				}),
				signal: AbortSignal.timeout(30_000)
			});
		} catch (error) {
			this.logger.error(`OpenRouter key exchange request failed: ${error}`);
			throw new BadGatewayException('Could not reach OpenRouter to complete the connection. Please try again.');
		}

		if (!response.ok) {
			const body = await response.text().catch(() => '');
			this.logger.warn(`OpenRouter key exchange rejected (${response.status}): ${body.slice(0, 300)}`);
			throw new BadGatewayException(
				`OpenRouter rejected the connection (HTTP ${response.status}). The authorization may have expired — please try connecting again.`
			);
		}

		const payload = (await response.json().catch(() => null)) as { key?: string } | null;
		if (!payload?.key) {
			throw new BadGatewayException('OpenRouter did not return an API key for this authorization.');
		}

		return await this.upsert({
			providerId,
			apiKey: payload.key,
			enabled: true,
			...(input.organizationId ? { organizationId: input.organizationId } : {})
		});
	}

	/**
	 * Create or update the tenant's credential for a provider (one credential
	 * per `(tenant, providerId)` pair). The API key is encrypted before storage;
	 * when omitted on update, the previously stored key is kept. Setting
	 * `isDefault: true` clears the flag on the tenant's other credentials.
	 *
	 * @param input - The credential payload (provider id required; API key required on first create).
	 * @returns The persisted credential with a masked API key.
	 */
	async upsert(
		input: IAiProviderCredentialCreateInput | IAiProviderCredentialUpdateInput
	): Promise<IAiProviderCredential> {
		// SECURITY: the tenant always comes from the authenticated request
		// context — a body-supplied tenantId must never re-scope the write.
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new BadRequestException('Tenant context is required.');
		}
		const providerId = input.providerId?.toLowerCase();

		if (!providerId) {
			throw new BadRequestException('Provider id is required.');
		}

		const { record: existing } = await this.findOneOrFailByOptions({
			where: { providerId, tenantId } as FindOptionsWhere<AiProviderCredential>
		});

		if (!existing && !input.apiKey) {
			this.assertKeyOptional(providerId);
		}
		this.assertBaseUrlSatisfied(providerId, input.baseUrl ?? existing?.baseUrl);

		// Encrypt the incoming API key; keep the stored one when omitted.
		const payload: Partial<AiProviderCredential> = { ...input, providerId, tenantId } as Partial<AiProviderCredential>;
		if (input.apiKey) {
			payload.apiKey = this.encryptionService.encrypt(input.apiKey);
		} else {
			delete payload.apiKey;
		}

		// Ensure at most one default credential per tenant — separately for chat and for voice.
		if (input.isDefault) {
			await this.clearOtherDefaults(tenantId, existing?.id);
		}
		if (input.isVoiceDefault) {
			await this.clearOtherVoiceDefaults(tenantId, existing?.id);
		}

		if (existing) {
			await super.update(existing.id, payload as any);
			return this.maskCredential(await this.findOneByIdString(existing.id));
		}

		return this.maskCredential(await super.create(payload));
	}

	/**
	 * Throw a 400 unless the provider is registered as running WITHOUT an API key.
	 *
	 * Called only when a credential is being CREATED with no key. Cloud providers keep the historical
	 * "API key is required" behaviour; local servers (`requiresApiKey: false`) may be saved with only
	 * a base URL. An unregistered provider id is treated as requiring a key — the registry is the sole
	 * authority on which providers work anonymously, and a typo must not open a key-less path.
	 *
	 * @param providerId - Registry id being configured.
	 */
	private assertKeyOptional(providerId: string): void {
		const definition = AiProviderRegistry.get(providerId);
		if (definition?.requiresApiKey === false) {
			return;
		}
		throw new BadRequestException(
			definition
				? `An API key is required to create a credential for provider '${definition.label}'.`
				: `An API key is required to create a credential for provider '${providerId}'.`
		);
	}

	/**
	 * Throw a 400 when a provider that cannot work without a base URL is saved without one — a
	 * generic OpenAI-compatible gateway has no vendor host to fall back to, so a key-only credential
	 * would report itself configured and then fail every request.
	 *
	 * @param providerId - Registry id being configured.
	 * @param baseUrl - The base URL that would be stored (incoming, or the existing one on update).
	 */
	private assertBaseUrlSatisfied(providerId: string, baseUrl?: string): void {
		const definition = AiProviderRegistry.get(providerId);
		if (!definition?.requiresBaseUrl || baseUrl?.trim()) {
			return;
		}
		if (definition.baseUrlEnvVar && process.env[definition.baseUrlEnvVar]) {
			return;
		}
		throw new BadRequestException(
			`A base URL is required for provider '${definition.label}' — enter the address of your server (e.g. http://localhost:8000/v1).`
		);
	}

	/**
	 * Update an existing credential by id. The provider id is immutable —
	 * use {@link upsert} to configure a different provider. A provided API key
	 * is re-encrypted; setting `isDefault: true` clears the tenant's other defaults.
	 *
	 * @param id - The credential id (tenant-scoped lookup).
	 * @param input - The fields to update.
	 * @returns The updated credential with a masked API key.
	 */
	async updateCredential(id: ID, input: IAiProviderCredentialUpdateInput): Promise<IAiProviderCredential> {
		const existing = await this.findOneByIdString(id);

		const payload: Partial<AiProviderCredential> = { ...input } as Partial<AiProviderCredential>;
		delete (payload as any).providerId; // provider identity is immutable per credential
		delete (payload as any).tenantId; // never re-parent a credential

		if (input.apiKey) {
			payload.apiKey = this.encryptionService.encrypt(input.apiKey);
		} else {
			delete payload.apiKey;
		}

		this.assertBaseUrlSatisfied(existing.providerId, input.baseUrl ?? existing.baseUrl);

		if (input.isDefault) {
			await this.clearOtherDefaults(existing.tenantId, existing.id);
		}
		if (input.isVoiceDefault) {
			await this.clearOtherVoiceDefaults(existing.tenantId, existing.id);
		}

		await super.update(existing.id, payload as any);
		return this.maskCredential(await this.findOneByIdString(existing.id));
	}

	/**
	 * List the current tenant's credentials with masked API keys
	 * (`'••••' + last 4 characters` of the decrypted key).
	 * Safe to return to clients — decrypted keys never leave the server.
	 *
	 * @returns Paginated credentials with masked secrets.
	 */
	async findAllMasked(): Promise<IPagination<IAiProviderCredential>> {
		const { items, total } = await this.findAll({ order: { createdAt: 'DESC' } as any });
		return {
			items: items.map((credential) => this.maskCredential(credential)),
			total
		};
	}

	/**
	 * Clear the `isDefault` flag on all of the tenant's other credentials.
	 *
	 * @param tenantId - The tenant whose defaults are being cleared.
	 * @param exceptId - Credential id to leave untouched (the new default), if any.
	 */
	private async clearOtherDefaults(tenantId: string, exceptId?: ID): Promise<void> {
		const others = await this.find({
			where: { tenantId, isDefault: true } as FindOptionsWhere<AiProviderCredential>
		});
		for (const other of others) {
			if (exceptId && other.id === exceptId) {
				continue;
			}
			await super.update(other.id, { isDefault: false } as any);
		}
	}

	/**
	 * Clear the `isVoiceDefault` flag on all of the tenant's other credentials, so at most one
	 * provider is the tenant's dictation provider.
	 *
	 * @param tenantId - The tenant whose voice defaults are being cleared.
	 * @param exceptId - Credential id to leave untouched (the new voice default), if any.
	 */
	async clearOtherVoiceDefaults(tenantId: string, exceptId?: ID): Promise<void> {
		const others = await this.find({
			where: { tenantId, isVoiceDefault: true } as FindOptionsWhere<AiProviderCredential>
		});
		for (const other of others) {
			if (exceptId && other.id === exceptId) {
				continue;
			}
			await super.update(other.id, { isVoiceDefault: false } as any);
		}
	}

	/**
	 * Replace the (encrypted) API key with a masked hint: `'••••' + last 4`
	 * characters of the decrypted key. When decryption is not possible the
	 * mask alone is returned; when no key is stored, `apiKey` is undefined.
	 *
	 * @param credential - The credential entity to mask.
	 * @returns A plain object safe for serialization to clients.
	 */
	private maskCredential(credential: AiProviderCredential): IAiProviderCredential {
		const masked = { ...credential } as IAiProviderCredential;
		if (credential.apiKey) {
			let last4 = '';
			try {
				last4 = this.encryptionService.decrypt(credential.apiKey).slice(-4);
			} catch {
				// Undecryptable (e.g. rotated ENCRYPTION_KEY) — expose the bare mask only.
			}
			masked.apiKey = `${API_KEY_MASK_PREFIX}${last4}`;
		} else {
			delete masked.apiKey;
		}
		return masked;
	}
}
