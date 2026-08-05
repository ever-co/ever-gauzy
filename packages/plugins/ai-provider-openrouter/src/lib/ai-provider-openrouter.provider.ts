import type { LanguageModel } from 'ai';
import { AiProviderEnum, IAiChatModel } from '@gauzy/contracts';
import { IAiChatProviderDefinition, IAiProviderCredentials, importEsm } from '@gauzy/plugin-ai-chat';

/** Stable provider id used by the registry, the UI and BYOK credentials. */
const PROVIDER_ID = AiProviderEnum.OPENROUTER;

/**
 * Popular chat models routed through OpenRouter (shown in the model selector).
 * Slugs as listed by https://openrouter.ai/models — any other valid slug can
 * still be requested since OpenRouter accepts arbitrary `creator/model` ids.
 */
const MODELS: IAiChatModel[] = [
	{ id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', providerId: PROVIDER_ID },
	{ id: 'openai/gpt-5.5', label: 'GPT-5.5', providerId: PROVIDER_ID },
	{ id: 'google/gemini-3.5-flash', label: 'Gemini 3.5 Flash', providerId: PROVIDER_ID },
	{ id: 'x-ai/grok-4.3', label: 'Grok 4.3', providerId: PROVIDER_ID },
	{ id: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro', providerId: PROVIDER_ID }
];

/**
 * Fallback free models, used when OpenRouter's catalogue cannot be reached.
 *
 * These exist so a network blip cannot disable the AI agent entirely. They are a floor, not the
 * source of truth — the live list is fetched below. Free slugs are retired without notice, so
 * `OPENROUTER_FREE_MODELS` lets an operator correct drift with a restart instead of a release.
 */
const FALLBACK_FREE_MODELS: IAiChatModel[] = [
	{ id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 (free)', providerId: PROVIDER_ID },
	{ id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (free)', providerId: PROVIDER_ID },
	{ id: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B (free)', providerId: PROVIDER_ID },
	{ id: 'qwen/qwen-2.5-72b-instruct:free', label: 'Qwen 2.5 72B (free)', providerId: PROVIDER_ID }
];

/** OpenRouter marks free models with a `:free` suffix on the slug. */
const FREE_SUFFIX = ':free';

/** Cache the fetched catalogue: this is consulted on every /config call and every turn. */
const FREE_MODEL_TTL_MS = 30 * 60 * 1000;
let freeModelCache: { models: IAiChatModel[]; fetchedAt: number } | null = null;
/** In-flight fetch, so a burst of concurrent requests makes ONE network call. */
let freeModelInFlight: Promise<IAiChatModel[]> | null = null;

/** Turn a slug into something readable: 'meta-llama/llama-3.3-70b-instruct:free' -> the model name. */
const labelFor = (id: string, name?: string): string => {
	if (name) return name.includes('(free)') ? name : `${name} (free)`;
	const slug = id.slice(0, -FREE_SUFFIX.length);
	return `${slug.split('/').pop() ?? slug} (free)`;
};

/**
 * The free models currently offered by OpenRouter.
 *
 * Order of truth: an explicit `OPENROUTER_FREE_MODELS` override, then the live catalogue, then the
 * pinned fallback. The fetch is cached and de-duplicated; on failure the previous cache is preferred
 * over the fallback, because a stale-but-real list beats a guess.
 */
const listFreeModels = async (): Promise<IAiChatModel[]> => {
	const override = process.env.OPENROUTER_FREE_MODELS;
	if (override) {
		// The override is an ALLOWLIST for the shared key, so it is held to the same rule as the
		// fetched list: a paid slug here would otherwise be spendable on the platform account, which
		// is exactly what this tier exists to prevent. Anything without the free suffix is dropped,
		// and if that leaves nothing we return empty — which DISABLES the platform tier rather than
		// silently falling back to models nobody vetted.
		const ids = override
			.split(',')
			.map((entry) => entry.trim())
			.filter((id) => id.endsWith(FREE_SUFFIX));
		return ids.map((id) => ({ id, label: labelFor(id), providerId: PROVIDER_ID }));
	}

	const cached = freeModelCache;
	if (cached && Date.now() - cached.fetchedAt < FREE_MODEL_TTL_MS) return cached.models;
	// Explicit null check rather than truthiness: a Promise is ALWAYS truthy, so `if (inFlight)`
	// reads like a forgotten `await` (and is flagged as one — typescript:S6544).
	if (freeModelInFlight !== null) return freeModelInFlight;

	freeModelInFlight = (async () => {
		try {
			// Public endpoint — no key needed, which matters because this is also called to decide
			// whether the platform tier is offered at all.
			const response = await fetch('https://openrouter.ai/api/v1/models', {
				signal: AbortSignal.timeout(8000)
			});
			if (!response.ok) throw new Error(`OpenRouter /models returned ${response.status}`);
			const body = (await response.json()) as { data?: { id: string; name?: string }[] };
			const models = (body.data ?? [])
				.filter((m) => typeof m?.id === 'string' && m.id.endsWith(FREE_SUFFIX))
				.map((m) => ({ id: m.id, label: labelFor(m.id, m.name), providerId: PROVIDER_ID }));
			if (!models.length) throw new Error('OpenRouter /models listed no :free models');
			freeModelCache = { models, fetchedAt: Date.now() };
			return models;
		} catch {
			// Keep serving a previously fetched list rather than dropping to the pinned guess.
			return freeModelCache?.models ?? FALLBACK_FREE_MODELS;
		} finally {
			freeModelInFlight = null;
		}
	})();

	return freeModelInFlight;
};

/**
 * OpenRouter provider definition for the AI chat engine.
 *
 * Registered with the {@link AiProviderRegistry} by {@link AiProviderOpenRouterPlugin}.
 * The ESM-only `@openrouter/ai-sdk-provider` package is loaded lazily via
 * `importEsm` so this CommonJS-compiled plugin never `require()`s it at
 * module load time.
 */
export const openRouterProviderDefinition: IAiChatProviderDefinition = {
	id: PROVIDER_ID,
	label: 'OpenRouter',
	apiKeyEnvVars: ['OPENROUTER_API_KEY'],
	baseUrlEnvVar: 'OPENROUTER_BASE_URL',
	models: MODELS,
	defaultModel: 'anthropic/claude-sonnet-5',
	/**
	 * Shared key that makes the AI agent work with no setup, restricted to OpenRouter's free models.
	 *
	 * Separate from OPENROUTER_API_KEY on purpose: an operator who sets THAT one is bringing their
	 * own (possibly paid) account and must not be capped to the free tier.
	 */
	platformApiKeyEnvVar: 'OPENROUTER_PLATFORM_API_KEY',
	listPlatformModels: listFreeModels,
	order: 20,
	websiteUrl: 'https://openrouter.ai',
	apiKeysUrl: 'https://openrouter.ai/keys',
	// OpenRouter's PKCE flow: the browser authorizes on openrouter.ai and the
	// backend exchanges the returned code for an API key (no manual copy/paste).
	connect: {
		type: 'openrouter-pkce',
		authorizeUrl: 'https://openrouter.ai/auth'
	},

	/**
	 * Create an OpenRouter chat `LanguageModel` for the given model slug and credentials.
	 *
	 * @param modelId OpenRouter model slug (e.g. 'anthropic/claude-sonnet-5').
	 * @param credentials Resolved credentials (tenant BYOK or environment).
	 */
	async createModel(modelId: string, credentials: IAiProviderCredentials) {
		// Second enforcement layer, and the one that actually protects the shared account: the engine
		// already rejects non-free ids on the platform path, but this survives any future caller that
		// builds a model without going through resolveModel.
		if (credentials.source === 'platform' && !modelId.endsWith(FREE_SUFFIX)) {
			throw new Error(
				`Refusing to use '${modelId}' on the shared free-tier key: only ${FREE_SUFFIX} models are permitted.`
			);
		}

		const { createOpenRouter } = await importEsm<typeof import('@openrouter/ai-sdk-provider')>(
			'@openrouter/ai-sdk-provider'
		);
		const provider = createOpenRouter({
			apiKey: credentials.apiKey,
			...(credentials.baseUrl ? { baseURL: credentials.baseUrl } : {})
		});

		// On the shared key, hand OpenRouter the other free slugs as server-side fallbacks. A model
		// that is rate limited or momentarily unavailable then fails over INSIDE OpenRouter, before
		// any error reaches us — which is the cheapest possible reduction in 429s on a tier whose
		// whole characteristic is being rate limited.
		let settings: { models?: string[] } | undefined;
		if (credentials.source === 'platform') {
			const alternates = (await listFreeModels()).map((m) => m.id).filter((id) => id !== modelId);
			if (alternates.length) settings = { models: alternates };
		}

		// `@openrouter/ai-sdk-provider@2.x` targets ai@6 and bundles its own copy of
		// the `@ai-sdk/provider` v3 spec types. The produced model implements
		// `LanguageModelV3`, which is part of ai@7's `LanguageModel` union, so it is
		// runtime-compatible — the cast only bridges the duplicated declaration files.
		return provider.chat(modelId, settings) as unknown as LanguageModel;
	}
};
