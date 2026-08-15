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
const PROVIDER_ID = AiProviderEnum.GROQ;

/** Groq's OpenAI-compatible API base. */
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';

/**
 * Chat models offered by Groq (shown in the model selector). All support tool calling.
 * Model ids as accepted by Groq's OpenAI-compatible `/chat/completions`.
 */
const MODELS: IAiChatModel[] = [
	{ id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile', providerId: PROVIDER_ID },
	{ id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', providerId: PROVIDER_ID },
	{ id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', providerId: PROVIDER_ID },
	{ id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B', providerId: PROVIDER_ID }
];

/**
 * Speech-to-text models (Whisper, served by Groq's LPU inference).
 * `whisper-large-v3-turbo` is the default: near-identical accuracy to large-v3 at a fraction of the
 * cost and latency, which is what dictation wants.
 */
const SPEECH_MODELS: IAiChatModel[] = [
	{ id: 'whisper-large-v3-turbo', label: 'Whisper Large v3 Turbo', providerId: PROVIDER_ID },
	{ id: 'whisper-large-v3', label: 'Whisper Large v3', providerId: PROVIDER_ID }
];

/** Speech model used when the tenant has not chosen one. */
const DEFAULT_SPEECH_MODEL = 'whisper-large-v3-turbo';

/**
 * Non-chat families listed by `/models` next to the chat models — the speech models themselves,
 * guard/moderation models, and TTS. A denylist, like the OpenAI plugin's: `/models` reports no
 * capability fields, and an allowlist would hide the next model family the day it ships.
 */
const NON_CHAT_PATTERNS = [/whisper/, /-tts\b/, /playai/, /guard/, /prompt-guard/, /orpheus/];

/** Model catalogue cache, keyed per credential. */
const catalogueCache = createCatalogueCache<IAiChatModel[]>();

/**
 * The Groq models this API key can address, minus the non-chat families.
 * Merged BELOW the curated list — the curated entries are the ones verified against the agent's
 * tool use.
 */
const listCatalogue = async (credentials: IAiProviderCredentials | null): Promise<IAiChatModelList> =>
	keyedCatalogue({
		credentials,
		curated: MODELS,
		cache: catalogueCache,
		load: async (resolved) => {
			const body = await fetchCatalogueJson<{ data?: { id: string }[] }>(`${DEFAULT_BASE_URL}/models`, {
				headers: { authorization: `Bearer ${resolved.apiKey}` }
			});
			const fetched = (body.data ?? [])
				.filter((m) => typeof m?.id === 'string' && !NON_CHAT_PATTERNS.some((pattern) => pattern.test(m.id)))
				.map((m) => ({ id: m.id, label: prettifyModelId(m.id), providerId: PROVIDER_ID }))
				.sort((a, b) => a.id.localeCompare(b.id));
			return fetched.length ? mergeCatalogue(MODELS, fetched) : [];
		}
	});

/**
 * Speech-to-text through Groq's OpenAI-shaped `/audio/transcriptions` endpoint.
 * The request, error classification and secret redaction are the shared helper's.
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
		providerLabel: 'Groq',
		providerId: PROVIDER_ID
	});

/**
 * Groq provider definition for the AI chat engine.
 *
 * Chat goes through the ESM-only `@ai-sdk/openai-compatible` package (Groq's API is
 * OpenAI-shaped), loaded lazily via `importEsm` so this CommonJS-compiled plugin never
 * `require()`s it at module load time. Speech-to-text goes through the shared helper.
 */
export const groqProviderDefinition: IAiChatProviderDefinition = {
	id: PROVIDER_ID,
	label: 'Groq',
	apiKeyEnvVars: ['GROQ_API_KEY'],
	baseUrlEnvVar: 'GROQ_BASE_URL',
	models: MODELS,
	defaultModel: 'llama-3.3-70b-versatile',
	listModels: listCatalogue,
	transcribe: transcribeAudio,
	speech: { models: SPEECH_MODELS, defaultModel: DEFAULT_SPEECH_MODEL },
	defaultBaseUrl: DEFAULT_BASE_URL,
	order: 80,
	websiteUrl: 'https://groq.com',
	apiKeysUrl: 'https://console.groq.com/keys',

	/**
	 * Create a Groq `LanguageModel` for the given model id and credentials.
	 *
	 * @param modelId Groq model id (e.g. 'llama-3.3-70b-versatile').
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
