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
const PROVIDER_ID = AiProviderEnum.ANTHROPIC;

/**
 * Chat models offered by Anthropic (shown in the model selector).
 * Model ids as accepted by the Anthropic Messages API / `@ai-sdk/anthropic`.
 */
const MODELS: IAiChatModel[] = [
	{ id: 'claude-sonnet-5', label: 'Claude Sonnet 5', providerId: PROVIDER_ID },
	{ id: 'claude-opus-5', label: 'Claude Opus 5', providerId: PROVIDER_ID },
	{ id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', providerId: PROVIDER_ID }
];

/**
 * Models that predate the Messages API's tool support and would fail on every agent turn.
 *
 * A denylist rather than an allowlist because `/v1/models` reports no capability fields at all — see
 * {@link listCatalogue}. Everything Claude 3 and later can call tools.
 */
const LEGACY_MODEL_PATTERN = /^claude-(2|instant)/;

/** Model catalogue cache, keyed per credential: what a key can see is account-specific. */
const catalogueCache = createCatalogueCache<IAiChatModel[]>();

/**
 * The Claude models this API key can address.
 *
 * `GET /v1/models` returns ids and display names only — there is no tool-capability field to filter
 * on, so the legacy denylist above IS the filter. That is safe here in a way it would not be for a
 * multi-vendor catalogue: every current Claude model supports tool use.
 *
 * Two easy mistakes are handled explicitly: the endpoint defaults to **20** results (so the limit is
 * pinned high, otherwise a picker silently loses models), and it requires the `anthropic-version`
 * header or answers 400.
 */
const listCatalogue = async (credentials: IAiProviderCredentials | null): Promise<IAiChatModel[]> =>
	keyedCatalogue({
		credentials,
		curated: MODELS,
		cache: catalogueCache,
		load: async (resolved) => {
			const body = await fetchCatalogueJson<{ data?: { id: string; display_name?: string }[] }>(
				'https://api.anthropic.com/v1/models?limit=1000',
				{ headers: { 'x-api-key': resolved.apiKey, 'anthropic-version': '2023-06-01' } }
			);
			return (body.data ?? [])
				.filter((m) => typeof m?.id === 'string' && !LEGACY_MODEL_PATTERN.test(m.id))
				.map((m) => ({
					id: m.id,
					label: m.display_name ?? prettifyModelId(m.id),
					providerId: PROVIDER_ID
				}));
		}
	});

/**
 * Anthropic (Claude) provider definition for the AI chat engine.
 *
 * Registered with the {@link AiProviderRegistry} by {@link AiProviderAnthropicPlugin}.
 * The ESM-only `@ai-sdk/anthropic` package is loaded lazily via `importEsm`
 * so this CommonJS-compiled plugin never `require()`s it at module load time.
 */
export const anthropicProviderDefinition: IAiChatProviderDefinition = {
	id: PROVIDER_ID,
	label: 'Anthropic',
	apiKeyEnvVars: ['ANTHROPIC_API_KEY'],
	baseUrlEnvVar: 'ANTHROPIC_BASE_URL',
	models: MODELS,
	defaultModel: 'claude-sonnet-5',
	listModels: listCatalogue,
	order: 40,
	websiteUrl: 'https://www.anthropic.com',
	apiKeysUrl: 'https://console.anthropic.com/settings/keys',

	/**
	 * Create a Claude `LanguageModel` for the given model id and credentials.
	 *
	 * @param modelId Anthropic model id (e.g. 'claude-sonnet-5').
	 * @param credentials Resolved credentials (tenant BYOK or environment).
	 */
	async createModel(modelId: string, credentials: IAiProviderCredentials) {
		const { createAnthropic } = await importEsm<typeof import('@ai-sdk/anthropic')>('@ai-sdk/anthropic');
		const provider = createAnthropic({
			apiKey: credentials.apiKey,
			...(credentials.baseUrl ? { baseURL: credentials.baseUrl } : {})
		});
		return provider(modelId);
	}
};
