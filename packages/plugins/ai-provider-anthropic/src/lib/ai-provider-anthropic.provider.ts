import { AiProviderEnum, IAiChatModel } from '@gauzy/contracts';
import { IAiChatProviderDefinition, IAiProviderCredentials, importEsm } from '@gauzy/plugin-ai-chat';

/** Stable provider id used by the registry, the UI and BYOK credentials. */
const PROVIDER_ID = AiProviderEnum.ANTHROPIC;

/**
 * Chat models offered by Anthropic (shown in the model selector).
 * Model ids as accepted by the Anthropic Messages API / `@ai-sdk/anthropic`.
 */
const MODELS: IAiChatModel[] = [
	{ id: 'claude-sonnet-5', label: 'Claude Sonnet 5', providerId: PROVIDER_ID },
	{ id: 'claude-opus-4-8', label: 'Claude Opus 4.8', providerId: PROVIDER_ID },
	{ id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', providerId: PROVIDER_ID }
];

/**
 * Anthropic (Claude) provider definition for the AI chat engine.
 *
 * Registered with the {@link AiProviderRegistry} by {@link AiProviderAnthropicPlugin}.
 * The ESM-only `@ai-sdk/anthropic` package is loaded lazily via `importEsm`
 * so this CommonJS-compiled plugin never `require()`s it at module load time.
 */
export const anthropicProviderDefinition: IAiChatProviderDefinition = {
	id: PROVIDER_ID,
	label: 'Anthropic',
	apiKeyEnvVars: ['ANTHROPIC_API_KEY'],
	baseUrlEnvVar: 'ANTHROPIC_BASE_URL',
	models: MODELS,
	defaultModel: 'claude-sonnet-5',

	/**
	 * Create a Claude `LanguageModel` for the given model id and credentials.
	 *
	 * @param modelId Anthropic model id (e.g. 'claude-sonnet-5').
	 * @param credentials Resolved credentials (tenant BYOK or environment).
	 */
	async createModel(modelId: string, credentials: IAiProviderCredentials) {
		const { createAnthropic } = await importEsm<typeof import('@ai-sdk/anthropic')>('@ai-sdk/anthropic');
		const provider = createAnthropic({
			apiKey: credentials.apiKey,
			...(credentials.baseUrl ? { baseURL: credentials.baseUrl } : {})
		});
		return provider(modelId);
	}
};
