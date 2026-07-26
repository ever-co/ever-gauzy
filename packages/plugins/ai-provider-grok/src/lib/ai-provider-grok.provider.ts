import { AiProviderEnum, IAiChatModel } from '@gauzy/contracts';
import { IAiChatProviderDefinition, IAiProviderCredentials, importEsm } from '@gauzy/plugin-ai-chat';

/** Stable provider id used by the registry, the UI and BYOK credentials. */
const PROVIDER_ID = AiProviderEnum.GROK;

/**
 * Chat models offered by Grok (shown in the model selector).
 * Model ids as accepted by `@ai-sdk/xai`.
 */
const MODELS: IAiChatModel[] = [
	{ id: 'grok-4.3', label: 'Grok 4.3', providerId: PROVIDER_ID },
	{ id: 'grok-4.3-mini', label: 'Grok 4.3 Mini', providerId: PROVIDER_ID }
];

/**
 * Grok provider definition for the AI chat engine.
 *
 * Registered with the AiProviderRegistry by the plugin class. The ESM-only
 * `@ai-sdk/xai` package is loaded lazily via `importEsm` so this
 * CommonJS-compiled plugin never `require()`s it at module load time.
 */
export const grokProviderDefinition: IAiChatProviderDefinition = {
	id: PROVIDER_ID,
	label: 'Grok',
	apiKeyEnvVars: ['XAI_API_KEY', 'GROK_API_KEY'],
	baseUrlEnvVar: 'XAI_BASE_URL',
	models: MODELS,
	defaultModel: 'grok-4.3',
	order: 70,
	websiteUrl: 'https://x.ai',
	apiKeysUrl: 'https://console.x.ai',

	/**
	 * Create a Grok `LanguageModel` for the given model id and credentials.
	 *
	 * @param modelId Grok model id (e.g. 'grok-4.3').
	 * @param credentials Resolved credentials (tenant BYOK or environment).
	 */
	async createModel(modelId: string, credentials: IAiProviderCredentials) {
		const { createXai } = await importEsm<typeof import('@ai-sdk/xai')>('@ai-sdk/xai');
		const provider = createXai({
			apiKey: credentials.apiKey,
			...(credentials.baseUrl ? { baseURL: credentials.baseUrl } : {})
		});
		return provider(modelId);
	}
};
