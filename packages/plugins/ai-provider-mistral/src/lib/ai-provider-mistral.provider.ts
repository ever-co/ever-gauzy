import { AiProviderEnum, IAiChatModel } from '@gauzy/contracts';
import {
	IAiChatModelList,
	IAiChatProviderDefinition,
	IAiProviderCredentials,
	IAiTranscribeOptions,
	createCatalogueCache,
	fetchCatalogueJson,
	importEsm,
	keyedCatalogue,
	mergeCatalogue,
	prettifyModelId,
	transcribeViaOpenAiCompatible
} from '@gauzy/plugin-ai-chat';

/** Stable provider id used by the registry, the UI and BYOK credentials. */
const PROVIDER_ID = AiProviderEnum.MISTRAL;

/** Mistral's OpenAI-compatible API base ("La Plateforme"). */
const DEFAULT_BASE_URL = 'https://api.mistral.ai/v1';

/**
 * Chat models offered by Mistral (shown in the model selector). The `-latest` aliases track the
 * current release of each size, so the curated list does not go stale on every model bump.
 */
const MODELS: IAiChatModel[] = [
	{ id: 'mistral-small-latest', label: 'Mistral Small', providerId: PROVIDER_ID },
	{ id: 'mistral-medium-latest', label: 'Mistral Medium', providerId: PROVIDER_ID },
	{ id: 'mistral-large-latest', label: 'Mistral Large', providerId: PROVIDER_ID }
];

/**
 * Speech-to-text models (Voxtral). `voxtral-mini-latest` is the default: it is the model Mistral
 * positions for transcription; `voxtral-small-latest` is the larger sibling.
 */
const SPEECH_MODELS: IAiChatModel[] = [
	{ id: 'voxtral-mini-latest', label: 'Voxtral Mini', providerId: PROVIDER_ID },
	{ id: 'voxtral-small-latest', label: 'Voxtral Small', providerId: PROVIDER_ID }
];

/** Speech model used when the tenant has not chosen one. */
const DEFAULT_SPEECH_MODEL = 'voxtral-mini-latest';

/**
 * Non-chat families listed by `/models`: embeddings, moderation, OCR, the speech models, and the
 * code-completion (FIM) models that have no tool calling.
 */
const NON_CHAT_PATTERNS = [/embed/, /moderation/, /ocr/, /voxtral/, /codestral/, /-fim/];

/** Model catalogue cache, keyed per credential. */
const catalogueCache = createCatalogueCache<IAiChatModel[]>();

/**
 * The Mistral models this API key can address, minus the non-chat families. Mistral's `/models`
 * does report `capabilities.function_calling`, so that is honoured when present.
 */
const listCatalogue = async (credentials: IAiProviderCredentials | null): Promise<IAiChatModelList> =>
	keyedCatalogue({
		credentials,
		curated: MODELS,
		cache: catalogueCache,
		load: async (resolved) => {
			const body = await fetchCatalogueJson<{
				data?: { id: string; capabilities?: { function_calling?: boolean; completion_chat?: boolean } }[];
			}>(`${DEFAULT_BASE_URL}/models`, { headers: { authorization: `Bearer ${resolved.apiKey}` } });
			const fetched = (body.data ?? [])
				.filter(
					(m) =>
						typeof m?.id === 'string' &&
						!NON_CHAT_PATTERNS.some((pattern) => pattern.test(m.id)) &&
						m.capabilities?.function_calling !== false &&
						m.capabilities?.completion_chat !== false
				)
				.map((m) => ({ id: m.id, label: prettifyModelId(m.id), providerId: PROVIDER_ID }))
				.sort((a, b) => a.id.localeCompare(b.id));
			return fetched.length ? mergeCatalogue(MODELS, fetched) : [];
		}
	});

/**
 * Speech-to-text through Mistral's OpenAI-shaped `/audio/transcriptions` endpoint (Voxtral).
 */
const transcribeAudio = async (
	audio: Buffer,
	mimeType: string,
	credentials: IAiProviderCredentials,
	options?: IAiTranscribeOptions
): Promise<string> =>
	transcribeViaOpenAiCompatible({
		baseUrl: credentials.baseUrl || DEFAULT_BASE_URL,
		apiKey: credentials.apiKey,
		audio,
		mimeType,
		model: options?.model || DEFAULT_SPEECH_MODEL,
		language: options?.language,
		providerLabel: 'Mistral',
		providerId: PROVIDER_ID
	});

/**
 * Mistral AI provider definition for the AI chat engine.
 *
 * Chat goes through the ESM-only `@ai-sdk/openai-compatible` package (Mistral's chat API is
 * OpenAI-shaped), loaded lazily via `importEsm`. Speech-to-text goes through the shared helper.
 */
export const mistralProviderDefinition: IAiChatProviderDefinition = {
	id: PROVIDER_ID,
	label: 'Mistral',
	apiKeyEnvVars: ['MISTRAL_API_KEY'],
	baseUrlEnvVar: 'MISTRAL_BASE_URL',
	models: MODELS,
	defaultModel: 'mistral-medium-latest',
	listModels: listCatalogue,
	transcribe: transcribeAudio,
	speech: { models: SPEECH_MODELS, defaultModel: DEFAULT_SPEECH_MODEL },
	defaultBaseUrl: DEFAULT_BASE_URL,
	order: 90,
	websiteUrl: 'https://mistral.ai',
	apiKeysUrl: 'https://console.mistral.ai/api-keys',

	/**
	 * Create a Mistral `LanguageModel` for the given model id and credentials.
	 *
	 * @param modelId Mistral model id (e.g. 'mistral-medium-latest').
	 * @param credentials Resolved credentials (tenant BYOK or environment).
	 */
	async createModel(modelId: string, credentials: IAiProviderCredentials) {
		const { createOpenAICompatible } = await importEsm<typeof import('@ai-sdk/openai-compatible')>(
			'@ai-sdk/openai-compatible'
		);
		const provider = createOpenAICompatible({
			name: PROVIDER_ID,
			baseURL: credentials.baseUrl || DEFAULT_BASE_URL,
			apiKey: credentials.apiKey
		});
		return provider.chatModel(modelId);
	}
};
