import { AiProviderEnum, IAiChatModel } from '@gauzy/contracts';
import {
	IAiChatProviderDefinition,
	IAiProviderCredentials,
	createCatalogueCache,
	fetchCatalogueJson,
	importEsm,
	keyedCatalogue,
	prettifyModelId
} from '@gauzy/plugin-ai-chat';

/** Stable provider id used by the registry, the UI and BYOK credentials. */
const PROVIDER_ID = AiProviderEnum.GROK;

/**
 * Chat models offered by Grok (shown in the model selector).
 * Model ids as accepted by `@ai-sdk/xai`.
 */
const MODELS: IAiChatModel[] = [{ id: 'grok-4.3', label: 'Grok 4.3', providerId: PROVIDER_ID }];

/** Model catalogue cache, keyed per credential. */
const catalogueCache = createCatalogueCache<IAiChatModel[]>();

/**
 * The Grok language models this API key can address.
 *
 * xAI splits its catalogue by modality — `/v1/language-models` already excludes the image models, so
 * no capability filtering is needed here. Note the response key is `models`, **not** the `data` that
 * every other OpenAI-shaped endpoint uses; reading `data` yields an empty list, which would look like
 * "no models" rather than a parsing mistake.
 */
const listCatalogue = async (credentials: IAiProviderCredentials | null): Promise<IAiChatModel[]> =>
	keyedCatalogue({
		credentials,
		curated: MODELS,
		cache: catalogueCache,
		load: async (resolved) => {
			const body = await fetchCatalogueJson<{ models?: { id: string }[] }>(
				'https://api.x.ai/v1/language-models',
				{ headers: { authorization: `Bearer ${resolved.apiKey}` } }
			);
			return (body.models ?? [])
				.filter((m) => typeof m?.id === 'string')
				.map((m) => ({ id: m.id, label: prettifyModelId(m.id), providerId: PROVIDER_ID }));
		}
	});

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
	listModels: listCatalogue,
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
