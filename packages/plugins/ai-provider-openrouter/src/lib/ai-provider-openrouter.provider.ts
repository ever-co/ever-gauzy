import type { LanguageModel } from 'ai';
import { AiProviderEnum, IAiChatModel } from '@gauzy/contracts';
import { IAiChatProviderDefinition, IAiProviderCredentials, importEsm } from '@gauzy/plugin-ai-chat';

/** Stable provider id used by the registry, the UI and BYOK credentials. */
const PROVIDER_ID = AiProviderEnum.OPENROUTER;

/**
 * Popular chat models routed through OpenRouter (shown in the model selector).
 * Slugs as listed by https://openrouter.ai/models — any other valid slug can
 * still be requested since OpenRouter accepts arbitrary `creator/model` ids.
 */
const MODELS: IAiChatModel[] = [
	{ id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', providerId: PROVIDER_ID },
	{ id: 'openai/gpt-5.5', label: 'GPT-5.5', providerId: PROVIDER_ID },
	{ id: 'google/gemini-3.5-flash', label: 'Gemini 3.5 Flash', providerId: PROVIDER_ID },
	{ id: 'x-ai/grok-4.3', label: 'Grok 4.3', providerId: PROVIDER_ID },
	{ id: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro', providerId: PROVIDER_ID }
];

/**
 * OpenRouter provider definition for the AI chat engine.
 *
 * Registered with the {@link AiProviderRegistry} by {@link AiProviderOpenRouterPlugin}.
 * The ESM-only `@openrouter/ai-sdk-provider` package is loaded lazily via
 * `importEsm` so this CommonJS-compiled plugin never `require()`s it at
 * module load time.
 */
export const openRouterProviderDefinition: IAiChatProviderDefinition = {
	id: PROVIDER_ID,
	label: 'OpenRouter',
	apiKeyEnvVars: ['OPENROUTER_API_KEY'],
	baseUrlEnvVar: 'OPENROUTER_BASE_URL',
	models: MODELS,
	defaultModel: 'anthropic/claude-sonnet-5',

	/**
	 * Create an OpenRouter chat `LanguageModel` for the given model slug and credentials.
	 *
	 * @param modelId OpenRouter model slug (e.g. 'anthropic/claude-sonnet-5').
	 * @param credentials Resolved credentials (tenant BYOK or environment).
	 */
	async createModel(modelId: string, credentials: IAiProviderCredentials) {
		const { createOpenRouter } = await importEsm<typeof import('@openrouter/ai-sdk-provider')>(
			'@openrouter/ai-sdk-provider'
		);
		const provider = createOpenRouter({
			apiKey: credentials.apiKey,
			...(credentials.baseUrl ? { baseURL: credentials.baseUrl } : {})
		});
		// `@openrouter/ai-sdk-provider@2.x` targets ai@6 and bundles its own copy of
		// the `@ai-sdk/provider` v3 spec types. The produced model implements
		// `LanguageModelV3`, which is part of ai@7's `LanguageModel` union, so it is
		// runtime-compatible — the cast only bridges the duplicated declaration files.
		return provider.chat(modelId) as unknown as LanguageModel;
	}
};
