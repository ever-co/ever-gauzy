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
	/** Where the credential came from. */
	source: 'tenant' | 'environment';
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
}
