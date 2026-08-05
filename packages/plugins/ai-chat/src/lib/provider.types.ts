import type { LanguageModel } from 'ai';
import { AiProviderConnectType, IAiChatModel } from '@gauzy/contracts';

/**
 * Credentials resolved for a provider at request time.
 * Sourced from the tenant's BYOK settings or server environment variables.
 */
export interface IAiProviderCredentials {
	/** Secret API key. */
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
	/** Display ordering (ascending) in provider lists/catalogs. Unset sorts last. */
	readonly order?: number;
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
}
