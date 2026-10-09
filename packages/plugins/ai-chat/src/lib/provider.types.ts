import type { EmbeddingModel, LanguageModel } from 'ai';
import { AiProviderConnectType, IAiChatModel } from '@gauzy/contracts';

/**
 * Credentials resolved for a provider at request time.
 * Sourced from the tenant's BYOK settings or server environment variables.
 */
export interface IAiProviderCredentials {
	/**
	 * Secret API key.
	 *
	 * Empty string for providers that declare `requiresApiKey: false` (local servers such as
	 * Speaches, LocalAI or whisper.cpp) when the tenant configured none — implementations must then
	 * omit the `Authorization` header rather than send `Bearer `.
	 */
	apiKey: string;
	/** Optional custom base URL (self-hosted / proxy endpoints). */
	baseUrl?: string;
	/**
	 * Where the credential came from.
	 *
	 * `'platform'` is a shared key the PRODUCT supplies so the AI agent works with no setup. It is
	 * resolved last — after the tenant's own key and after the operator's own environment key — and
	 * it is the only source that is restricted to the provider's free models. Keeping it distinct
	 * from `'environment'` is what makes that restriction safe: if the two shared one variable, a
	 * self-hoster who set their own paid key would be indistinguishable from the shared free key and
	 * would be silently downgraded.
	 */
	source: 'tenant' | 'environment' | 'platform';
}

/**
 * What a provider's {@link IAiChatProviderDefinition.listModels} hands back.
 *
 * Carries WHERE the list came from, not just the list. Returning a bare array made a curated
 * fallback indistinguishable from a live fetch, so the settings page reported every list as live —
 * including the one it shows before any key is saved, and including a cached list served after a
 * failed refresh. The UI has a message for each of those and could never reach either.
 */
export interface IAiChatModelList {
	models: IAiChatModel[];
	/** `'live'` came from the provider; `'curated'` is the pinned fallback. */
	source: 'live' | 'curated';
	/** Set when `'live'` models came from a cache whose refresh failed. */
	stale?: boolean;
}

/**
 * Per-request preferences for {@link IAiChatProviderDefinition.transcribe}.
 */
export interface IAiTranscribeOptions {
	/** Speech model id (one of `speech.models`); the provider's `speech.defaultModel` when unset. */
	model?: string;
	/** Optional language hint (ISO-639-1 such as `en`, or a BCP-47 tag). Unset = auto-detect. */
	language?: string;
}

/**
 * Speech-to-text catalogue advertised by a provider that implements `transcribe`.
 */
export interface IAiSpeechCatalogue {
	/** Speech models a tenant may pick for dictation. */
	models: IAiChatModel[];
	/** Model used when the tenant has not chosen one. */
	defaultModel: string;
}

/**
 * Contract implemented by AI provider plugins
 * (`@gauzy/plugin-ai-provider-anthropic`, `-openai`, `-openrouter`, …).
 *
 * A provider plugin registers one definition with the {@link AiProviderRegistry}
 * during its `onPluginBootstrap`. The chat engine resolves credentials
 * (tenant BYOK → env) and asks the definition for a `LanguageModel`.
 */
export interface IAiChatProviderDefinition {
	/** Stable provider id (see AiProviderEnum in @gauzy/contracts). */
	readonly id: string;
	/** Human-readable name shown in the UI. */
	readonly label: string;
	/**
	 * Environment variable(s) holding the server-wide API key,
	 * checked in order (first non-empty wins).
	 */
	readonly apiKeyEnvVars: string[];
	/** Optional env var for a custom base URL. */
	readonly baseUrlEnvVar?: string;
	/** Models this provider offers (shown in the model selector). */
	readonly models: IAiChatModel[];
	/** Default model id when the caller does not specify one. */
	readonly defaultModel: string;
	/**
	 * Env var holding a PLATFORM-supplied key: a shared key the product provides so the AI agent
	 * works with no setup, resolved only after every other source has come up empty.
	 *
	 * Deliberately separate from {@link apiKeyEnvVars} — see `IAiProviderCredentials.source` for why
	 * collapsing the two would silently downgrade self-hosters who bring their own paid key.
	 * Providers with no free tier leave this unset, which disables the platform tier for them.
	 */
	readonly platformApiKeyEnvVar?: string;
	/**
	 * The models usable on the platform key, resolved lazily so a provider can DISCOVER its free
	 * models at runtime rather than pinning a list that goes stale.
	 *
	 * This must be ENFORCED, not merely displayed: nothing else validates a requested model id, and
	 * the settings UI ships a free-text model field. An empty result disables the platform tier.
	 */
	listPlatformModels?(): Promise<IAiChatModel[]>;
	/** Default model id on the platform key. Falls back to the first entry of listPlatformModels(). */
	readonly platformDefaultModel?: string;
	/**
	 * The provider's model CATALOGUE, for the settings model picker.
	 *
	 * DISPLAY ONLY — the exact opposite of {@link listPlatformModels}, which is an enforced allowlist.
	 * Nothing validates a returned id and the picker keeps a free-text path, so this list is a
	 * convenience and MUST FAIL OPEN: on any error an implementation returns its curated
	 * {@link models} rather than throwing or returning `[]`. An empty array would empty the user's
	 * dropdown; it must never be how "the fetch failed" is expressed.
	 *
	 * Because of that asymmetry the two hooks must not be defined in terms of each other. Chaining
	 * them either widens the shared-key allowlist when a fetch fails, or empties the dropdown on a
	 * network blip. They may share a fetch and a cache; they must not share a failure mode.
	 *
	 * Implementations filter to models supporting TOOL CALLING — the agent calls tools every turn, so
	 * a model without them is useless here. Where a provider's API exposes no tool-capability field,
	 * the curated list IS the filter, and the implementation should say so.
	 *
	 * @param credentials Resolved credentials, or `null` when none exist yet. Providers with a public
	 *                    catalogue ignore this; the rest return their curated list when it is null.
	 */
	listModels?(credentials: IAiProviderCredentials | null): Promise<IAiChatModelList>;
	/**
	 * Transcribe recorded speech to text, for the chat's dictation control.
	 *
	 * Optional: providers without a speech model leave it unset and the endpoint falls through to
	 * the next configured provider that has one, so dictation works as long as ANY of the tenant's
	 * providers can transcribe — the user should not have to know which. The tenant can pin one
	 * ("voice default"); it is tried first.
	 *
	 * @param audio Raw recorded bytes as received from the browser's MediaRecorder.
	 * @param mimeType The container the browser produced (`audio/webm;codecs=opus`, `audio/mp4`, …).
	 * @param credentials Resolved credentials for this provider.
	 * @param options Tenant preferences: the speech `model` (from {@link speech}) and an optional
	 *                BCP-47 / ISO-639-1 `language` hint. Both optional; implementations fall back to
	 *                their `speech.defaultModel` / auto-detection.
	 * @returns The transcript. An empty string is a valid answer for silence.
	 */
	transcribe?(
		audio: Buffer,
		mimeType: string,
		credentials: IAiProviderCredentials,
		options?: IAiTranscribeOptions
	): Promise<string>;
	/**
	 * Speech-to-text catalogue: the models a tenant may pick for dictation and the one used when
	 * none is chosen. Only meaningful together with {@link transcribe}; a provider that transcribes
	 * with a single fixed model still declares it here so the settings page can show it.
	 */
	readonly speech?: IAiSpeechCatalogue;
	/**
	 * Whether credentials for this provider need an API key. Defaults to `true`.
	 *
	 * Local servers (Speaches, LocalAI, whisper.cpp, a self-hosted OpenAI-compatible endpoint) set
	 * `false`: a tenant credential may then be saved with only a base URL, and the credential
	 * resolver treats the provider as configured with an empty key. Implementations MUST omit the
	 * `Authorization` header when the key is empty.
	 */
	readonly requiresApiKey?: boolean;
	/**
	 * True for providers that run on the operator's / tenant's own infrastructure rather than a
	 * vendor cloud. Display-only ("Local" chip in the settings catalogue).
	 */
	readonly local?: boolean;
	/**
	 * Base URL used when neither the tenant credential nor `baseUrlEnvVar` provides one. Local
	 * servers advertise their conventional address here so the settings form can prefill it.
	 */
	readonly defaultBaseUrl?: string;
	/**
	 * True when the provider cannot work without a tenant-supplied base URL — a generic
	 * OpenAI-compatible gateway has no vendor host to default to.
	 */
	readonly requiresBaseUrl?: boolean;
	/** Display ordering (ascending) in provider lists/catalogs. Unset sorts last. */
	readonly order?: number;
	/**
	 * Whether this provider can actually serve a chat model. Defaults to true.
	 *
	 * Having a credential is NOT proof of that. A provider registered as a placeholder — one whose
	 * `createModel` still throws — can otherwise be selected the moment ANY credential resolves for
	 * it, including a tenant BYOK key the user saved themselves, and then fails on every turn.
	 * Removing its env vars only closes the environment route, because tenant credentials are
	 * resolved first.
	 *
	 * Set this to false until `createModel` returns a real model.
	 */
	readonly chatCapable?: boolean;
	/** Provider marketing/home page (shown in the settings UI). */
	readonly websiteUrl?: string;
	/** Page where the user can create/manage API keys ("Get API key" link). */
	readonly apiKeysUrl?: string;
	/**
	 * Optional "Connect" flow support. When set, the settings UI offers a
	 * Connect button in addition to manual key entry, and the backend
	 * exchanges the flow's result for an API key (see the credentials
	 * controller's `/connect` endpoint).
	 */
	readonly connect?: {
		type: AiProviderConnectType;
		/** Authorization page the browser is sent to (callback/challenge params appended by the client). */
		authorizeUrl: string;
	};
	/**
	 * Create a LanguageModel for the given model id and credentials.
	 * Implementations lazily import their ESM-only provider package.
	 */
	createModel(modelId: string, credentials: IAiProviderCredentials): Promise<LanguageModel>;
	/**
	 * Optional embedding capability, used by the Documents knowledge pipeline
	 * (`@gauzy/plugin-docs`) for chunk and query embeddings.
	 *
	 * Providers that support text embeddings return a Vercel AI SDK `EmbeddingModel` for the
	 * given model id and resolved credentials, following the same lazy-ESM import pattern as
	 * {@link createModel}. Providers without an embedding endpoint simply leave this unset —
	 * callers MUST feature-detect (`typeof definition.createEmbeddingModel === 'function'`)
	 * and degrade to lexical-only behavior rather than erroring.
	 *
	 * NOTE: in AI SDK 7 `EmbeddingModel` (from `ai`) is a non-generic union
	 * (`string | EmbeddingModelV4 | …`) — earlier SDK majors typed it `EmbeddingModel<string>`.
	 *
	 * @param modelId Embedding model id (e.g. 'text-embedding-3-small').
	 * @param credentials Resolved credentials (tenant BYOK, environment, or platform).
	 */
	createEmbeddingModel?(modelId: string, credentials: IAiProviderCredentials): Promise<EmbeddingModel>;
}
