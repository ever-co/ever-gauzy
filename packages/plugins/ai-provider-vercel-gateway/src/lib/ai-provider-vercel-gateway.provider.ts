import { AiProviderEnum, IAiChatModel } from '@gauzy/contracts';
import {
	IAiChatProviderDefinition,
	IAiProviderCredentials,
	createCatalogueCache,
	fetchCatalogueJson,
	importEsm,
	publicCatalogue
} from '@gauzy/plugin-ai-chat';

/** Stable provider id used by the registry, the UI and BYOK credentials. */
const PROVIDER_ID = AiProviderEnum.VERCEL_GATEWAY;

/**
 * Popular chat models routed through the Vercel AI Gateway (shown in the
 * model selector). Slugs as listed by the gateway's model catalog — any other
 * valid `creator/model` slug can still be requested.
 */
const MODELS: IAiChatModel[] = [
	{ id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', providerId: PROVIDER_ID },
	{ id: 'anthropic/claude-opus-5', label: 'Claude Opus 5', providerId: PROVIDER_ID },
	{ id: 'openai/gpt-5.5', label: 'GPT-5.5', providerId: PROVIDER_ID },
	{ id: 'google/gemini-3.5-flash', label: 'Gemini 3.5 Flash', providerId: PROVIDER_ID }
];

/** Model catalogue cache. The gateway publishes its catalogue publicly, so no credential is needed. */
const catalogueCache = createCatalogueCache<IAiChatModel[]>();

/**
 * Every gateway model that is a chat model AND can call tools.
 *
 * Three filters, each removing a distinct kind of unusable entry: the catalogue also lists embedding,
 * image, video, speech and reranking models (`type`), some language models cannot call tools at all
 * (`supported_parameters`, which agrees exactly with the `tool-use` tag), and retired models stay
 * listed with a `deprecated_at` stamp.
 */
const listCatalogue = async (): Promise<IAiChatModel[]> =>
	publicCatalogue({
		curated: MODELS,
		cache: catalogueCache,
		load: async () => {
			const body = await fetchCatalogueJson<{
				data?: {
					id: string;
					name?: string;
					type?: string;
					deprecated_at?: string | number | null;
					supported_parameters?: string[];
				}[];
			}>('https://ai-gateway.vercel.sh/v1/models');
			return (body.data ?? [])
				.filter(
					(m) =>
						typeof m?.id === 'string' &&
						m.type === 'language' &&
						!m.deprecated_at &&
						(m.supported_parameters ?? []).includes('tools')
				)
				.map((m) => ({ id: m.id, label: m.name ?? m.id, providerId: PROVIDER_ID }));
		}
	});

/**
 * Vercel AI Gateway provider definition for the AI chat engine.
 *
 * Registered with the {@link AiProviderRegistry} by {@link AiProviderVercelGatewayPlugin}.
 * The ESM-only `@ai-sdk/gateway` package is loaded lazily via `importEsm`
 * so this CommonJS-compiled plugin never `require()`s it at module load time.
 */
export const vercelGatewayProviderDefinition: IAiChatProviderDefinition = {
	id: PROVIDER_ID,
	label: 'Vercel AI Gateway',
	apiKeyEnvVars: ['AI_GATEWAY_API_KEY'],
	baseUrlEnvVar: 'AI_GATEWAY_BASE_URL',
	models: MODELS,
	defaultModel: 'anthropic/claude-sonnet-5',
	listModels: listCatalogue,
	order: 30,
	websiteUrl: 'https://vercel.com/ai-gateway',
	apiKeysUrl: 'https://vercel.com/dashboard',

	/**
	 * Create a gateway-routed `LanguageModel` for the given model slug and credentials.
	 *
	 * @param modelId Gateway model slug (e.g. 'anthropic/claude-sonnet-5').
	 * @param credentials Resolved credentials (tenant BYOK or environment).
	 */
	async createModel(modelId: string, credentials: IAiProviderCredentials) {
		const { createGateway } = await importEsm<typeof import('@ai-sdk/gateway')>('@ai-sdk/gateway');
		const provider = createGateway({
			apiKey: credentials.apiKey,
			...(credentials.baseUrl ? { baseURL: credentials.baseUrl } : {})
		});
		return provider(modelId);
	}
};
