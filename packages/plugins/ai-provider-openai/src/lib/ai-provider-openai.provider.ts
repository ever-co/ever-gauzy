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
			return mergeCatalogue(MODELS, fetched);
		}
	});

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
