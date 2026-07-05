import type { LanguageModel } from 'ai';
import { IAiChatModel } from '@gauzy/contracts';

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
	/**
	 * Create a LanguageModel for the given model id and credentials.
	 * Implementations lazily import their ESM-only provider package.
	 */
	createModel(modelId: string, credentials: IAiProviderCredentials): Promise<LanguageModel>;
}
