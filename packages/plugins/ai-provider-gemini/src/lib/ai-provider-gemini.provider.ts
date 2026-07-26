import { AiProviderEnum, IAiChatModel } from '@gauzy/contracts';
import { IAiChatProviderDefinition, IAiProviderCredentials, importEsm } from '@gauzy/plugin-ai-chat';

/** Stable provider id used by the registry, the UI and BYOK credentials. */
const PROVIDER_ID = AiProviderEnum.GEMINI;

/**
 * Chat models offered by Gemini (shown in the model selector).
 * Model ids as accepted by `@ai-sdk/google`.
 */
const MODELS: IAiChatModel[] = [
	{ id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', providerId: PROVIDER_ID },
	{ id: 'gemini-3.5-pro', label: 'Gemini 3.5 Pro', providerId: PROVIDER_ID }
];

/**
 * Gemini provider definition for the AI chat engine.
 *
 * Registered with the AiProviderRegistry by the plugin class. The ESM-only
 * `@ai-sdk/google` package is loaded lazily via `importEsm` so this
 * CommonJS-compiled plugin never `require()`s it at module load time.
 */
export const geminiProviderDefinition: IAiChatProviderDefinition = {
	id: PROVIDER_ID,
	label: 'Gemini',
	apiKeyEnvVars: ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
	baseUrlEnvVar: 'GEMINI_BASE_URL',
	models: MODELS,
	defaultModel: 'gemini-3.5-flash',
	order: 60,
	websiteUrl: 'https://ai.google.dev',
	apiKeysUrl: 'https://aistudio.google.com/apikey',

	/**
	 * Create a Gemini `LanguageModel` for the given model id and credentials.
	 *
	 * @param modelId Gemini model id (e.g. 'gemini-3.5-flash').
	 * @param credentials Resolved credentials (tenant BYOK or environment).
	 */
	async createModel(modelId: string, credentials: IAiProviderCredentials) {
		const { createGoogleGenerativeAI } = await importEsm<typeof import('@ai-sdk/google')>('@ai-sdk/google');
		const provider = createGoogleGenerativeAI({
			apiKey: credentials.apiKey,
			...(credentials.baseUrl ? { baseURL: credentials.baseUrl } : {})
		});
		return provider(modelId);
	}
};
