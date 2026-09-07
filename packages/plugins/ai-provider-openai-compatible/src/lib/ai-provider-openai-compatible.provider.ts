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
const PROVIDER_ID = AiProviderEnum.OPENAI_COMPATIBLE;

/**
 * No curated chat list: this provider is whatever server the tenant points it at (vLLM, LM Studio,
 * Ollama's `/v1`, LiteLLM, text-generation-webui, …), and its `/v1/models` is the only truthful
 * catalogue. The picker's "Custom model…" path covers a server that does not implement `/models`.
 */
const MODELS: IAiChatModel[] = [];

/**
 * Speech-to-text: most OpenAI-compatible servers that implement `/audio/transcriptions` accept the
 * OpenAI model name `whisper-1` (LocalAI, LiteLLM routes, Speaches aliases). It only works when the
 * server implements the endpoint — a server that does not answers 404, which surfaces as a
 * provider error and the engine falls through to the next capable provider.
 */
const SPEECH_MODELS: IAiChatModel[] = [{ id: 'whisper-1', label: 'Whisper (whisper-1)', providerId: PROVIDER_ID }];

/** Speech model used when the tenant has not chosen one. */
const DEFAULT_SPEECH_MODEL = 'whisper-1';

/** Families listed by `/v1/models` that are not chat models. */
const NON_CHAT_PATTERNS = [/whisper/i, /embed/i, /\btts\b/i, /rerank/i, /moderation/i];

/** Catalogue cache, keyed per (base URL, credential). */
const catalogueCache = createCatalogueCache<IAiChatModel[]>();

/**
 * The chat models the tenant's server lists (`GET {baseUrl}/models`, OpenAI-shaped).
 * Nothing is fetched without a base URL — there is no default host for this provider.
 */
const listCatalogue = async (credentials: IAiProviderCredentials | null): Promise<IAiChatModelList> =>
	selfHostedCatalogue({
		credentials,
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
 * Speech-to-text through the server's `/audio/transcriptions`, if it has one.
 *
 * Throws when no base URL is configured — this provider has no vendor host to default to.
 */
const transcribeAudio = async (
	audio: Buffer,
	mimeType: string,
	credentials: IAiProviderCredentials,
	options?: IAiTranscribeOptions
): Promise<string> => {
	if (!credentials.baseUrl) {
		throw new Error('OpenAI-compatible transcription failed: no base URL is configured for this provider.');
	}
	return transcribeViaOpenAiCompatible({
		baseUrl: credentials.baseUrl,
		apiKey: credentials.apiKey,
		audio,
		mimeType,
		model: options?.model || DEFAULT_SPEECH_MODEL,
		language: options?.language,
		providerLabel: 'OpenAI-compatible',
		providerId: PROVIDER_ID
	});
};

/**
 * Generic OpenAI-compatible endpoint provider definition — self-hosted / gateway chat + STT.
 *
 * The TENANT supplies the base URL (`requiresBaseUrl`); an API key is optional (`requiresApiKey:
 * false`) because most local servers run without one. Chat goes through the ESM-only
 * `@ai-sdk/openai-compatible` package, loaded lazily via `importEsm`.
 */
export const openAiCompatibleProviderDefinition: IAiChatProviderDefinition = {
	id: PROVIDER_ID,
	label: 'OpenAI-compatible',
	apiKeyEnvVars: ['OPENAI_COMPATIBLE_API_KEY'],
	baseUrlEnvVar: 'OPENAI_COMPATIBLE_BASE_URL',
	models: MODELS,
	defaultModel: '',
	requiresApiKey: false,
	requiresBaseUrl: true,
	local: true,
	listModels: listCatalogue,
	transcribe: transcribeAudio,
	speech: { models: SPEECH_MODELS, defaultModel: DEFAULT_SPEECH_MODEL },
	order: 103,

	/**
	 * Create a `LanguageModel` served by the tenant's endpoint for the given model id.
	 *
	 * @param modelId Model name as the server lists it (e.g. 'llama3.1:8b', 'Qwen/Qwen2.5-7B-Instruct').
	 * @param credentials Resolved credentials — the base URL is required; the key is optional.
	 * @throws When no base URL is configured, or no model id was chosen (this provider has no default).
	 */
	async createModel(modelId: string, credentials: IAiProviderCredentials) {
		if (!credentials.baseUrl) {
			throw new Error(
				'The OpenAI-compatible provider needs a base URL — enter the address of your server in Settings → AI Providers.'
			);
		}
		if (!modelId) {
			throw new Error(
				'The OpenAI-compatible provider has no default model — pick one (or type its id) in Settings → AI Providers.'
			);
		}
		const { createOpenAICompatible } = await importEsm<typeof import('@ai-sdk/openai-compatible')>(
			'@ai-sdk/openai-compatible'
		);
		const provider = createOpenAICompatible({
			name: PROVIDER_ID,
			baseURL: credentials.baseUrl,
			...(credentials.apiKey ? { apiKey: credentials.apiKey } : {})
		});
		return provider.chatModel(modelId);
	}
};
