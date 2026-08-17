import { AiProviderEnum, IAiChatModel } from '@gauzy/contracts';
import {
	IAiChatModelList,
	IAiChatProviderDefinition,
	IAiProviderCredentials,
	IAiTranscribeOptions,
	createCatalogueCache,
	fetchCatalogueJson,
	importEsm,
	prettifyModelId,
	selfHostedCatalogue,
	transcribeViaOpenAiCompatible,
	trimTrailingSlash
} from '@gauzy/plugin-ai-chat';

/** Stable provider id used by the registry, the UI and BYOK credentials. */
const PROVIDER_ID = AiProviderEnum.LOCALAI;

/**
 * Where a LocalAI container listens by default (`docker run -p 8080:8080 localai/localai`).
 * Advertised to the settings form as a prefill; the provider is only CONFIGURED once a tenant or the
 * operator (`LOCALAI_BASE_URL`) actually points at a server.
 */
const DEFAULT_BASE_URL = 'http://localhost:8080/v1';

/**
 * Curated chat models. LocalAI's model gallery is open-ended and every install differs, so this is a
 * short list of gallery names commonly installed; the live `/v1/models` of the tenant's server is
 * what the picker really shows.
 */
const MODELS: IAiChatModel[] = [
	{ id: 'llama-3.2-3b-instruct:q4_k_m', label: 'Llama 3.2 3B Instruct', providerId: PROVIDER_ID },
	{ id: 'qwen2.5-7b-instruct', label: 'Qwen 2.5 7B Instruct', providerId: PROVIDER_ID },
	{ id: 'mistral-7b-instruct-v0.3', label: 'Mistral 7B Instruct', providerId: PROVIDER_ID }
];

/**
 * Speech-to-text: LocalAI exposes its whisper backend under the OpenAI-compatible model name
 * `whisper-1` when installed from the gallery (`local-ai models install whisper-1`).
 */
const SPEECH_MODELS: IAiChatModel[] = [{ id: 'whisper-1', label: 'Whisper (whisper-1)', providerId: PROVIDER_ID }];

/** Speech model used when the tenant has not chosen one. */
const DEFAULT_SPEECH_MODEL = 'whisper-1';

/** Families listed by `/v1/models` that are not chat models. */
const NON_CHAT_PATTERNS = [/whisper/i, /embed/i, /tts/i, /stablediffusion/i, /rerank/i];

/** Catalogue cache, keyed per (base URL, credential). */
const catalogueCache = createCatalogueCache<IAiChatModel[]>();

/**
 * The chat models loaded on the tenant's LocalAI server (`GET /v1/models`, OpenAI-shaped).
 * Display-only; fails open to the curated list.
 */
const listCatalogue = async (credentials: IAiProviderCredentials | null): Promise<IAiChatModelList> =>
	selfHostedCatalogue({
		credentials,
		defaultBaseUrl: DEFAULT_BASE_URL,
		curated: MODELS,
		cache: catalogueCache,
		load: async (baseUrl, resolved) => {
			const body = await fetchCatalogueJson<{ data?: { id: string }[] }>(
				`${trimTrailingSlash(baseUrl)}/models`,
				resolved?.apiKey ? { headers: { authorization: `Bearer ${resolved.apiKey}` } } : undefined
			);
			return (body.data ?? [])
				.filter((m) => typeof m?.id === 'string' && !NON_CHAT_PATTERNS.some((pattern) => pattern.test(m.id)))
				.map((m) => ({ id: m.id, label: prettifyModelId(m.id), providerId: PROVIDER_ID }))
				.sort((a, b) => a.id.localeCompare(b.id));
		}
	});

/**
 * Speech-to-text through LocalAI's OpenAI-shaped `/v1/audio/transcriptions` (whisper backend).
 * No `Authorization` header is sent when the server runs without a key.
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
		providerLabel: 'LocalAI',
		providerId: PROVIDER_ID
	});

/**
 * LocalAI provider definition — LOCAL chat + speech-to-text.
 *
 * Runs on the tenant's / operator's own infrastructure, needs no API key. Chat goes through the
 * ESM-only `@ai-sdk/openai-compatible` package (LocalAI is OpenAI-shaped), loaded lazily via
 * `importEsm`; speech-to-text goes through the shared helper.
 */
export const localAiProviderDefinition: IAiChatProviderDefinition = {
	id: PROVIDER_ID,
	label: 'LocalAI',
	apiKeyEnvVars: ['LOCALAI_API_KEY'],
	baseUrlEnvVar: 'LOCALAI_BASE_URL',
	models: MODELS,
	defaultModel: 'llama-3.2-3b-instruct:q4_k_m',
	requiresApiKey: false,
	local: true,
	defaultBaseUrl: DEFAULT_BASE_URL,
	listModels: listCatalogue,
	transcribe: transcribeAudio,
	speech: { models: SPEECH_MODELS, defaultModel: DEFAULT_SPEECH_MODEL },
	order: 101,
	websiteUrl: 'https://localai.io',

	/**
	 * Create a `LanguageModel` served by the tenant's LocalAI for the given model id.
	 *
	 * @param modelId Model name as loaded on the server (e.g. 'llama-3.2-3b-instruct:q4_k_m').
	 * @param credentials Resolved credentials (base URL; the key is usually empty).
	 */
	async createModel(modelId: string, credentials: IAiProviderCredentials) {
		const { createOpenAICompatible } = await importEsm<typeof import('@ai-sdk/openai-compatible')>(
			'@ai-sdk/openai-compatible'
		);
		const provider = createOpenAICompatible({
			name: PROVIDER_ID,
			baseURL: credentials.baseUrl || DEFAULT_BASE_URL,
			// `apiKey` adds `Authorization: Bearer …` only when set — an empty key must not send one.
			...(credentials.apiKey ? { apiKey: credentials.apiKey } : {})
		});
		return provider.chatModel(modelId);
	}
};
