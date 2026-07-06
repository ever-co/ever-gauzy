import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

/**
 * Well-known AI provider identifiers.
 *
 * Each provider is implemented as its own backend plugin
 * (e.g. `@gauzy/plugin-ai-provider-anthropic`) that registers itself
 * with the `@gauzy/plugin-ai-chat` provider registry. Additional
 * providers may register with ids outside this enum.
 */
export enum AiProviderEnum {
	ANTHROPIC = 'anthropic',
	OPENAI = 'openai',
	OPENROUTER = 'openrouter',
	VERCEL_GATEWAY = 'vercel-gateway',
	GAUZY_AI = 'gauzy-ai'
}

/**
 * A chat model offered by a registered AI provider.
 */
export interface IAiChatModel {
	/** Model identifier as understood by the provider (e.g. 'claude-sonnet-5'). */
	id: string;
	/** Human-readable label (e.g. 'Claude Sonnet 5'). */
	label: string;
	/** Provider this model belongs to. */
	providerId: string;
}

/**
 * Registered AI provider as reported by `GET /api/ai-chat/config`.
 * Never includes credentials.
 */
export interface IAiChatProvider {
	/** Provider identifier (see {@link AiProviderEnum}). */
	id: string;
	/** Human-readable provider name. */
	label: string;
	/** Models this provider offers. */
	models: IAiChatModel[];
	/**
	 * Whether the provider is usable for the current tenant —
	 * i.e. a tenant (BYOK) credential or a server env credential exists.
	 */
	configured: boolean;
	/** Where the active credential comes from. */
	credentialSource?: 'tenant' | 'environment';
}

/**
 * AI Chat runtime configuration for the current tenant/user,
 * returned by `GET /api/ai-chat/config`.
 */
export interface IAiChatConfig {
	/** Whether AI chat is enabled and at least one provider is configured. */
	enabled: boolean;
	/** Registered providers (with configuration status, without secrets). */
	providers: IAiChatProvider[];
	/** Default provider id used when the client does not request one. */
	defaultProvider?: string;
	/** Default model id used when the client does not request one. */
	defaultModel?: string;
}

/**
 * Per-tenant BYOK ("bring your own key") credential for an AI provider.
 * The API key is stored encrypted at rest and is never returned in full
 * by read endpoints (only a masked hint).
 */
export interface IAiProviderCredential extends IBasePerTenantAndOrganizationEntityModel {
	/** Provider identifier (see {@link AiProviderEnum}). */
	providerId: string;
	/** Secret API key (write-only; masked on read). */
	apiKey?: string;
	/** Optional custom base URL (e.g. self-hosted OpenRouter-compatible endpoint). */
	baseUrl?: string;
	/** Whether this credential is active. */
	enabled: boolean;
	/** Preferred default model for this provider (overrides provider default). */
	defaultModel?: string;
	/** Whether this provider is the tenant's default for chat. */
	isDefault?: boolean;
}

export interface IAiProviderCredentialFindInput extends IBasePerTenantAndOrganizationEntityModel {
	id?: string;
	providerId?: string;
}

export interface IAiProviderCredentialCreateInput
	extends Omit<IAiProviderCredential, 'apiKey'> {
	/** Secret API key — required when creating a credential. */
	apiKey: string;
}

export interface IAiProviderCredentialUpdateInput extends Partial<IAiProviderCredentialCreateInput> {}
