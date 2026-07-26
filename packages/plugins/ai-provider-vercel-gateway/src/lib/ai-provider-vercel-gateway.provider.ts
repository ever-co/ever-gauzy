import { AiProviderEnum, IAiChatModel } from '@gauzy/contracts';
import { IAiChatProviderDefinition, IAiProviderCredentials, importEsm } from '@gauzy/plugin-ai-chat';

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
