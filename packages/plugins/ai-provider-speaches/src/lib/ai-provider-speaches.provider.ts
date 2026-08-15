import { AiProviderEnum, IAiChatModel } from '@gauzy/contracts';
import {
	IAiChatModelList,
	IAiChatProviderDefinition,
	IAiProviderCredentials,
	IAiTranscribeOptions,
	createCatalogueCache,
	fetchCatalogueJson,
	prettifyModelId,
	selfHostedCatalogue,
	transcribeViaOpenAiCompatible,
	trimTrailingSlash
} from '@gauzy/plugin-ai-chat';

/** Stable provider id used by the registry, the UI and BYOK credentials. */
const PROVIDER_ID = AiProviderEnum.SPEACHES;

/**
 * Where a Speaches container listens by default (`docker run -p 8000:8000 ghcr.io/speaches-ai/speaches`).
 * Advertised to the settings form as a prefill; the provider is only CONFIGURED once a tenant or the
 * operator (`SPEACHES_BASE_URL`) actually points at a server.
 */
const DEFAULT_BASE_URL = 'http://localhost:8000/v1';

/**
 * Speech-to-text models (faster-whisper CTranslate2 conversions, pulled on demand by Speaches).
 * `Systran/faster-whisper-small` is the default: fast on CPU and good enough for dictation.
 */
const SPEECH_MODELS: IAiChatModel[] = [
	{ id: 'Systran/faster-whisper-small', label: 'Faster Whisper Small', providerId: PROVIDER_ID },
	{ id: 'Systran/faster-distil-whisper-large-v3', label: 'Distil-Whisper Large v3', providerId: PROVIDER_ID },
	{ id: 'deepdml/faster-whisper-large-v3-turbo-ct2', label: 'Faster Whisper Large v3 Turbo', providerId: PROVIDER_ID }
];

/** Speech model used when the tenant has not chosen one. */
const DEFAULT_SPEECH_MODEL = 'Systran/faster-whisper-small';

/** Catalogue cache, keyed per (base URL, credential). */
const catalogueCache = createCatalogueCache<IAiChatModel[]>();

/**
 * The speech models installed on the tenant's Speaches server (`GET /v1/models`, OpenAI-shaped).
 *
 * Speaches lists whisper AND TTS/other models; the `task` field (when present) tells them apart,
 * otherwise anything that looks like a whisper model is kept. This is a display-only catalogue for
 * the settings page — it fails open to the curated list.
 */
const listCatalogue = async (credentials: IAiProviderCredentials | null): Promise<IAiChatModelList> =>
	selfHostedCatalogue({
		credentials,
		defaultBaseUrl: DEFAULT_BASE_URL,
		curated: SPEECH_MODELS,
		cache: catalogueCache,
		load: async (baseUrl, resolved) => {
			const body = await fetchCatalogueJson<{ data?: { id: string; task?: string }[] }>(
				`${trimTrailingSlash(baseUrl)}/models`,
				resolved?.apiKey ? { headers: { authorization: `Bearer ${resolved.apiKey}` } } : undefined
			);
			return (body.data ?? [])
				.filter(
					(m) =>
						typeof m?.id === 'string' &&
						(m.task ? m.task === 'automatic-speech-recognition' : /whisper/i.test(m.id))
				)
				.map((m) => ({ id: m.id, label: prettifyModelId(m.id), providerId: PROVIDER_ID }));
		}
	});

/**
 * Speech-to-text through Speaches' OpenAI-shaped `/v1/audio/transcriptions`.
 * No `Authorization` header is sent when the server runs without a key (the common case).
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
		providerLabel: 'Speaches',
		providerId: PROVIDER_ID
	});

/**
 * Speaches (faster-whisper-server) provider definition — LOCAL SPEECH-TO-TEXT ONLY.
 *
 * Runs on the tenant's / operator's own infrastructure (Docker), needs no API key, and is
 * `chatCapable: false`: it appears in the catalogue as a local voice provider and can be the
 * tenant's voice default, but is never selectable for chat.
 */
export const speachesProviderDefinition: IAiChatProviderDefinition = {
	id: PROVIDER_ID,
	label: 'Speaches',
	apiKeyEnvVars: ['SPEACHES_API_KEY'],
	baseUrlEnvVar: 'SPEACHES_BASE_URL',
	models: [],
	defaultModel: '',
	chatCapable: false,
	requiresApiKey: false,
	local: true,
	defaultBaseUrl: DEFAULT_BASE_URL,
	listModels: listCatalogue,
	transcribe: transcribeAudio,
	speech: { models: SPEECH_MODELS, defaultModel: DEFAULT_SPEECH_MODEL },
	order: 100,
	websiteUrl: 'https://speaches.ai',

	/**
	 * Not a chat provider.
	 *
	 * @param _modelId Ignored.
	 * @param _credentials Ignored.
	 * @throws Always — Speaches serves speech-to-text (and TTS), not chat.
	 */
	async createModel(_modelId: string, _credentials: IAiProviderCredentials): Promise<never> {
		throw new Error('Speaches is a speech-to-text server and cannot serve chat — select another provider for chat.');
	}
};
