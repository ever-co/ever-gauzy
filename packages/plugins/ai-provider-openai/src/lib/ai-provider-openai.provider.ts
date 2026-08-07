import { AiProviderEnum, IAiChatModel } from '@gauzy/contracts';
import {
	IAiChatModelList,
	IAiChatProviderDefinition,
	IAiProviderCredentials,
	createCatalogueCache,
	fetchCatalogueJson,
	importEsm,
	keyedCatalogue,
	mergeCatalogue,
	prettifyModelId
} from '@gauzy/plugin-ai-chat';

/** Stable provider id used by the registry, the UI and BYOK credentials. */
const PROVIDER_ID = AiProviderEnum.OPENAI;

/**
 * Chat models offered by OpenAI (shown in the model selector).
 * Model ids as accepted by the OpenAI Responses API / `@ai-sdk/openai`.
 */
const MODELS: IAiChatModel[] = [
	{ id: 'gpt-5.5', label: 'GPT-5.5', providerId: PROVIDER_ID },
	{ id: 'gpt-5.4', label: 'GPT-5.4', providerId: PROVIDER_ID },
	{ id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', providerId: PROVIDER_ID },
	{ id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano', providerId: PROVIDER_ID }
];

/**
 * Non-chat model families listed by `/v1/models` alongside the chat models.
 *
 * A denylist, not an allowlist: `/v1/models` reports no capability fields, and an allowlist of known
 * prefixes would hide the next model family on the day it ships — which is precisely when someone
 * comes looking for it in this dropdown. The cost of the other direction is a stray entry that fails
 * if selected, which the curated list ordering above already steers people away from.
 */
const NON_CHAT_PATTERNS = [
	/embedding/,
	/^whisper/,
	/^tts-/,
	/^dall-e/,
	// Unanchored: OpenAI also ships `chatgpt-image-latest`, which `^gpt-image` never matched — the
	// same anchoring mistake the note below flags for the legacy completion families.
	/gpt-image/,
	/moderation/,
	// The legacy completion families are listed as `text-davinci-003`, `code-davinci-002` and so on,
	// so anchoring to the start of the id misses every one of them.
	/(^|[-_])(davinci|babbage|curie|ada)/,
	/-(audio|realtime|transcribe|tts)\b/,
	/-search-preview/,
	// `gpt-3.5-turbo-instruct` is Completions-only: it has no tool calling, so it would be offered
	// here and then fail on the agent's very first turn. On OpenAI the `-instruct` suffix marks
	// exactly that family (it is other vendors' hosted Llama/Qwen builds that use it more broadly).
	/-instruct(-|$)/
];

/** Speech model for dictation. Cheaper and faster than whisper-1, and the current default. */
const TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe';

/**
 * Upstream budget for a transcription.
 *
 * Longer than a catalogue fetch on purpose: a minute of speech takes real time to process, and the
 * user is watching a spinner they started deliberately rather than a background refresh.
 */
const TRANSCRIBE_TIMEOUT_MS = 60_000;

/** Model catalogue cache, keyed per credential: model access is account-specific on OpenAI. */
const catalogueCache = createCatalogueCache<IAiChatModel[]>();

/**
 * The OpenAI models this API key can address, minus the families that are not chat models.
 *
 * This is the weakest of the six catalogues — `/v1/models` returns `{id, owned_by, created}` and
 * nothing about capabilities — so the fetched list is merged BELOW the curated one rather than
 * replacing it: the curated entries are the models actually verified against the agent's tool use.
 */
const listCatalogue = async (credentials: IAiProviderCredentials | null): Promise<IAiChatModelList> =>
	keyedCatalogue({
		credentials,
		curated: MODELS,
		cache: catalogueCache,
		load: async (resolved) => {
			const body = await fetchCatalogueJson<{ data?: { id: string }[] }>('https://api.openai.com/v1/models', {
				headers: { authorization: `Bearer ${resolved.apiKey}` }
			});
			const fetched = (body.data ?? [])
				.filter((m) => typeof m?.id === 'string' && !NON_CHAT_PATTERNS.some((pattern) => pattern.test(m.id)))
				.map((m) => ({ id: m.id, label: prettifyModelId(m.id), providerId: PROVIDER_ID }))
				.sort((a, b) => a.id.localeCompare(b.id));
			// An empty upstream list must NOT come back as `live`: merging always retains the curated
			// entries, so a non-empty result would be reported as a complete live catalogue and the
			// message explaining that nothing was fetched would never show. Empty in, empty out — the
			// helper then labels it curated.
			return fetched.length ? mergeCatalogue(MODELS, fetched) : [];
		}
	});

/**
 * Speech-to-text for the chat's dictation control.
 *
 * `/v1/audio/transcriptions` is multipart, and the filename EXTENSION is what OpenAI uses to decide
 * the container — a generic name is rejected with "Invalid file format" even when the bytes are
 * fine — so it is derived from the MIME type the browser actually recorded.
 *
 * A custom base URL is honoured here, unlike the model catalogue: the caller explicitly configured
 * that endpoint as their OpenAI, and this is a request they asked for rather than a background
 * fetch, so there is no credential going anywhere the user did not choose.
 */
const transcribeAudio = async (
	audio: Buffer,
	mimeType: string,
	credentials: IAiProviderCredentials
): Promise<string> => {
	// `audio/mpeg` is MP3, not MP4 — lumping it in with `mp4` named MP3 bytes `dictation.mp4`, and the
	// extension is exactly what OpenAI trusts to identify the container. MediaRecorder never produces
	// audio/mpeg, which is why this survived: it only bites when a caller feeds a pre-recorded file.
	// wav/flac/m4a are covered for the same caller class — every container OpenAI accepts that a MIME
	// type can name. What remains falling to `.webm` (e.g. raw `audio/aac`) has no extension in
	// OpenAI's accepted set at all, so no mapping could save it.
	const extension = mimeType.includes('mp4')
		? 'mp4'
		: mimeType.includes('mpeg')
		? 'mp3'
		: mimeType.includes('ogg')
		? 'ogg'
		: mimeType.includes('wav')
		? 'wav'
		: mimeType.includes('flac')
		? 'flac'
		: mimeType.includes('m4a') // audio/m4a and audio/x-m4a
		? 'm4a'
		: 'webm';
	const form = new FormData();
	form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), `dictation.${extension}`);
	form.append('model', TRANSCRIBE_MODEL);
	// No `response_format`: this model accepts ONLY `json`, which is the default. Asking for `text`
	// — which whisper-1 does support — is rejected outright, so every dictation would have failed.

	const base = credentials.baseUrl?.replace(/\/$/, '') ?? 'https://api.openai.com/v1';
	const response = await fetch(`${base}/audio/transcriptions`, {
		method: 'POST',
		headers: { authorization: `Bearer ${credentials.apiKey}` },
		body: form,
		signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS)
	});
	if (!response.ok) {
		// The bare status code was reaching the user as "check your API key" for EVERY failure class,
		// including quota and bad audio. Classify by status so the message is actionable.
		const credentialFailure = response.status === 401 || response.status === 403;
		const reason = credentialFailure
			? 'the API key was rejected'
			: response.status === 429
			? 'the rate or quota limit was hit'
			: response.status === 400
			? 'the audio was rejected (unsupported or empty recording)'
			: `HTTP ${response.status} ${response.statusText}`;
		// The response body is genuinely diagnostic for format/limit errors ("Invalid file format"),
		// so it is relayed — but NEVER on a credential failure, whose body echoes the API key back
		// ("Incorrect API key provided: sk-…"), and always redacted and truncated in case a proxy
		// routes a secret into some other status. This error's message reaches the chat user verbatim.
		const detail = credentialFailure
			? ''
			: (await response.text().catch(() => ''))
					.replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')
					.slice(0, 300)
					.trim();
		throw new Error(`OpenAI transcription failed: ${reason}${detail ? ` — ${detail}` : ''}`);
	}
	const body = (await response.json()) as { text?: string };
	return (body.text ?? '').trim();
};

/**
 * OpenAI (GPT) provider definition for the AI chat engine.
 *
 * Registered with the {@link AiProviderRegistry} by {@link AiProviderOpenAiPlugin}.
 * The ESM-only `@ai-sdk/openai` package is loaded lazily via `importEsm`
 * so this CommonJS-compiled plugin never `require()`s it at module load time.
 */
export const openAiProviderDefinition: IAiChatProviderDefinition = {
	id: PROVIDER_ID,
	label: 'OpenAI',
	apiKeyEnvVars: ['OPENAI_API_KEY'],
	baseUrlEnvVar: 'OPENAI_BASE_URL',
	models: MODELS,
	defaultModel: 'gpt-5.5',
	listModels: listCatalogue,
	transcribe: transcribeAudio,
	order: 50,
	websiteUrl: 'https://openai.com',
	apiKeysUrl: 'https://platform.openai.com/api-keys',

	/**
	 * Create a GPT `LanguageModel` for the given model id and credentials.
	 * Uses the provider's default (Responses API) language model.
	 *
	 * @param modelId OpenAI model id (e.g. 'gpt-5.5').
	 * @param credentials Resolved credentials (tenant BYOK or environment).
	 */
	async createModel(modelId: string, credentials: IAiProviderCredentials) {
		const { createOpenAI } = await importEsm<typeof import('@ai-sdk/openai')>('@ai-sdk/openai');
		const provider = createOpenAI({
			apiKey: credentials.apiKey,
			...(credentials.baseUrl ? { baseURL: credentials.baseUrl } : {})
		});
		return provider(modelId);
	}
};
