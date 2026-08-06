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
	GAUZY_AI = 'gauzy-ai',
	GEMINI = 'gemini',
	GROK = 'grok'
}

/**
 * "Connect" flows a provider supports as an alternative to pasting an API
 * key. Currently only OpenRouter's PKCE flow (the user authorizes on
 * openrouter.ai and the platform exchanges the returned code for a key).
 */
export type AiProviderConnectType = 'openrouter-pkce';

/**
 * Discriminator for a provider rate-limit (HTTP 429) reported through the chat stream.
 *
 * Lives in contracts because BOTH sides need the runtime value: the API writes the envelope into the
 * stream's error channel, and the browser matches on it. It must not come from the backend plugin —
 * importing that into the web bundle would pull NestJS along with it.
 */
export const AI_CHAT_RATE_LIMIT_CODE = 'ai-chat/rate-limited';

/**
 * Where the credential in use came from.
 *
 * `'platform'` is the shared, product-supplied free tier: resolved LAST — below the tenant's own key
 * and below the operator's own environment key — and the only source restricted to free models. The
 * key itself never reaches the client; only this label does.
 */
export type AiCredentialSource = 'tenant' | 'environment' | 'platform';

/** Structured rate-limit payload, JSON-encoded into the stream's single error-text channel. */
export interface IAiChatRateLimitEnvelope {
	code: typeof AI_CHAT_RATE_LIMIT_CODE;
	/** Which provider ran out of quota, so the UI can name it and deep-link to its settings. */
	providerId: string;
	/**
	 * Which credential hit the limit — it changes the advice. On `'platform'` the user can fix it by
	 * bringing their own key; on `'tenant'` their OWN key is limited, where "connect your own
	 * account" would be wrong.
	 */
	credentialSource: AiCredentialSource;
	/** Seconds until the limit resets, when the provider says so. */
	retryAfterSeconds?: number;
}

/**
 * A provider's model catalogue, returned by `GET /api/ai-chat/providers/:providerId/models`.
 *
 * Deliberately NOT part of `IAiChatConfig`: that endpoint is fetched at app bootstrap for every user
 * with chat access and already loops every registered provider, so putting keyed upstream calls in it
 * would put the app shell behind six third-party APIs on every login. This is fetched lazily, when a
 * single provider's config view is opened.
 */
export interface IAiChatModelCatalogue {
	providerId: string;
	models: IAiChatModel[];
	/** Where the list came from, so the UI can explain a short or stale list. */
	source: 'live' | 'curated' | 'platform';
	/** True when a live refresh failed and a previously cached list is being served. */
	stale?: boolean;
}

/** A chat model offered by a registered AI provider. */
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
	credentialSource?: AiCredentialSource;
	/** Display ordering (ascending) in provider lists/catalogs. */
	order?: number;
	/** Provider marketing/home page. */
	websiteUrl?: string;
	/** Page where the user can create/manage API keys for this provider. */
	apiKeysUrl?: string;
	/** Set when the provider supports a "Connect" flow (see {@link AiProviderConnectType}). */
	connectType?: AiProviderConnectType;
	/** Authorization page for the Connect flow (client appends callback/PKCE params). */
	connectAuthorizeUrl?: string;
}

/**
 * AI Chat runtime configuration for the current tenant/user,
 * returned by `GET /api/ai-chat/config`.
 */
export interface IAiChatConfig {
	/** Whether AI chat is enabled and at least one provider is configured. */
	enabled: boolean;
	/**
	 * Machine-readable reason why `enabled` is `false`, so the UI can tell the
	 * user what to fix instead of silently hiding the chat. Absent when enabled.
	 */
	disabledReason?: 'globally-disabled' | 'no-providers';
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

export interface IAiProviderCredentialCreateInput extends Omit<IAiProviderCredential, 'apiKey'> {
	/** Secret API key — required when creating a credential. */
	apiKey: string;
}

export interface IAiProviderCredentialUpdateInput extends Partial<IAiProviderCredentialCreateInput> {}
