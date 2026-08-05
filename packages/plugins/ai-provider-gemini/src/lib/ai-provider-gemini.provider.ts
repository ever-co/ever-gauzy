import { AiProviderEnum, IAiChatModel } from '@gauzy/contracts';
import {
	IAiChatModelList,
	IAiChatProviderDefinition,
	IAiProviderCredentials,
	createCatalogueCache,
	fetchCatalogueJson,
	importEsm,
	keyedCatalogue,
	prettifyModelId
} from '@gauzy/plugin-ai-chat';

/** Stable provider id used by the registry, the UI and BYOK credentials. */
const PROVIDER_ID = AiProviderEnum.GEMINI;

/**
 * Chat models offered by Gemini (shown in the model selector).
 * Model ids as accepted by `@ai-sdk/google`.
 */
const MODELS: IAiChatModel[] = [{ id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', providerId: PROVIDER_ID }];

/**
 * Model families that answer `generateContent` but cannot drive the agent.
 *
 * `supportedGenerationMethods` gates *chat*, not *tools* — image, video and embedding-adjacent models
 * pass it too — so this trims what that filter cannot.
 */
const NON_AGENT_PATTERNS = [/embedding/, /^aqa/, /^imagen/, /^veo/, /-image(-|$)/, /^learnlm/, /-tts(-|$)/];

/** Model catalogue cache, keyed per credential: model availability varies by API-key project. */
const catalogueCache = createCatalogueCache<IAiChatModel[]>();

/**
 * The Gemini models this API key can address.
 *
 * Two details the API punishes: the list is paginated with a default `pageSize` of 50 (pinned high
 * here, and the single page is accepted deliberately — 1000 is far beyond the real catalogue size),
 * and the key goes in the `x-goog-api-key` **header**. Passing it as `?key=` would put a live
 * credential into request URLs, which land in proxy and access logs.
 */
const listCatalogue = async (credentials: IAiProviderCredentials | null): Promise<IAiChatModelList> =>
	keyedCatalogue({
		credentials,
		curated: MODELS,
		cache: catalogueCache,
		load: async (resolved) => {
			const body = await fetchCatalogueJson<{
				models?: { name?: string; displayName?: string; supportedGenerationMethods?: string[] }[];
			}>('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
				headers: { 'x-goog-api-key': resolved.apiKey }
			});
			return (
				(body.models ?? [])
					.filter(
						(m) => typeof m?.name === 'string' && m.supportedGenerationMethods?.includes('generateContent')
					)
					// The API returns fully-qualified resource names ('models/gemini-3.5-flash'); the SDK
					// wants the bare id.
					.map((m) => ({ id: (m.name as string).replace(/^models\//, ''), displayName: m.displayName }))
					.filter((m) => !NON_AGENT_PATTERNS.some((pattern) => pattern.test(m.id)))
					.map((m) => ({
						id: m.id,
						label: m.displayName ?? prettifyModelId(m.id),
						providerId: PROVIDER_ID
					}))
			);
		}
	});

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
	listModels: listCatalogue,
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
