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
	GROK = 'grok',
	/** Groq cloud — OpenAI-compatible chat + Whisper speech-to-text. */
	GROQ = 'groq',
	/** Mistral AI — OpenAI-compatible chat + Voxtral speech-to-text. */
	MISTRAL = 'mistral',
	/** Deepgram — speech-to-text only (Nova models). */
	DEEPGRAM = 'deepgram',
	/** ElevenLabs — speech-to-text only (Scribe). */
	ELEVENLABS = 'elevenlabs',
	/** Speaches (faster-whisper-server) — LOCAL speech-to-text server. */
	SPEACHES = 'speaches',
	/** LocalAI — LOCAL OpenAI-compatible chat + whisper speech-to-text. */
	LOCALAI = 'localai',
	/** whisper.cpp `whisper-server` — LOCAL speech-to-text. */
	WHISPER_CPP = 'whisper-cpp',
	/** Any self-hosted OpenAI-compatible endpoint (vLLM, LM Studio, Ollama, LiteLLM …). */
	OPENAI_COMPATIBLE = 'openai-compatible'
}

/**
 * Machine-readable reasons a dictation (`POST /api/ai-chat/transcribe`) request fails with 503.
 *
 * Shared by the API (which puts them in the error body) and the chat client (which maps them to a
 * translated, actionable message with a deep link to the AI Providers settings page).
 */
export enum AiSpeechErrorCode {
	/** No speech-capable provider has usable credentials for this tenant. */
	NOT_CONFIGURED = 'AI_SPEECH_NOT_CONFIGURED',
	/** A speech provider rejected the credential (HTTP 401/403). */
	KEY_REJECTED = 'AI_SPEECH_KEY_REJECTED',
	/** Every attempted speech provider failed for another reason. */
	FAILED = 'AI_SPEECH_FAILED'
}

/** Route of the AI Providers settings page, deep-linked from speech errors. */
export const AI_CHAT_SETTINGS_PATH = '/pages/settings/ai';

/**
 * Body of a failed dictation response (HTTP 503) — an OBJECT rather than a bare string so old
 * clients still find a readable `message` while new ones branch on `code`.
 */
export interface IAiSpeechErrorBody {
	/** Human-readable explanation (kept for clients that only know `message`). */
	message: string;
	code: AiSpeechErrorCode;
	/** Where the problem is fixed (`/pages/settings/ai`). */
	settingsPath: string;
	/** HTTP status Nest adds to exception bodies. */
	statusCode?: number;
	/** Provider ids that were tried, when any were. */
	attemptedProviders?: string[];
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
	/**
	 * `false` when the provider is a registered PLACEHOLDER whose chat routing is not implemented yet
	 * (its `createModel` still throws). Distinct from `configured`, which conflates "no credential"
	 * with "not capable": the settings UI needs to tell those apart, because the remedy it suggests
	 * for one — "save an API key" — is a lie for the other. Absent means capable.
	 */
	chatCapable?: boolean;
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
	/**
	 * Whether the provider can transcribe speech (implements the `transcribe` hook), so it can be
	 * chosen as the tenant's voice (dictation) provider.
	 */
	speechCapable: boolean;
	/** Speech-to-text models a tenant may pick for dictation (speech-capable providers only). */
	speechModels?: IAiChatModel[];
	/** The speech model used when the tenant has not chosen one. */
	defaultSpeechModel?: string;
	/**
	 * Whether a credential for this provider needs an API key. Local servers (Speaches, LocalAI,
	 * whisper.cpp, a self-hosted OpenAI-compatible endpoint) usually run without one.
	 */
	requiresApiKey: boolean;
	/** True for providers that run on the user's own infrastructure (shown with a "Local" chip). */
	local?: boolean;
	/** Base URL the provider talks to when the tenant sets none (local servers advertise theirs). */
	defaultBaseUrl?: string;
	/** True when the provider is unusable without a tenant-supplied base URL (generic gateways). */
	requiresBaseUrl?: boolean;
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
	/**
	 * The tenant's chosen voice (dictation) provider id — the credential flagged `isVoiceDefault`.
	 * Absent when the tenant has not pinned one; dictation then walks the speech-capable providers.
	 */
	defaultVoiceProvider?: string;
	/**
	 * Whether at least one speech-capable provider has usable credentials (including local servers
	 * that need no key), i.e. whether dictation can work for this tenant right now.
	 */
	speechConfigured: boolean;
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
	/** Preferred default model for this provider (overrides provider default); `null` clears it. */
	defaultModel?: string | null;
	/** Whether this provider is the tenant's default for chat. */
	isDefault?: boolean;
	/**
	 * Whether this provider is the tenant's default for VOICE (dictation / speech-to-text).
	 * Independent of {@link isDefault}: a tenant may chat through Anthropic and dictate through a
	 * local whisper server. At most one credential per tenant has `isVoiceDefault = true`.
	 */
	isVoiceDefault?: boolean;
	/** Preferred speech-to-text model for this provider (overrides the provider's default); `null` clears it. */
	speechModel?: string | null;
}

export interface IAiProviderCredentialFindInput extends IBasePerTenantAndOrganizationEntityModel {
	id?: string;
	providerId?: string;
}

export interface IAiProviderCredentialCreateInput extends Omit<IAiProviderCredential, 'apiKey'> {
	/**
	 * Secret API key. Required when creating a credential for a provider that needs one; optional
	 * for local / self-hosted providers that advertise `requiresApiKey: false`.
	 */
	apiKey?: string;
}

export interface IAiProviderCredentialUpdateInput extends Partial<IAiProviderCredentialCreateInput> {}
