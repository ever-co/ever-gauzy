import type { IAiChatModelList } from '@gauzy/plugin-ai-chat';

/**
 * OpenRouter carries the only ENFORCED list of the six: `listPlatformModels` is the allowlist for the
 * shared free-tier key, so a paid slug leaking into it is spendable on the platform account. It has
 * the opposite failure mode from `listModels` — fail closed, not open — and the two are easy to
 * confuse, which is the whole reason they are tested side by side here.
 */
describe('openRouterProviderDefinition', () => {
	interface RouterModel {
		id: string;
		name?: string;
		supported_parameters?: string[];
	}

	const model = (id: string, overrides: Partial<RouterModel> = {}): RouterModel => ({
		id,
		supported_parameters: ['tools', 'tool_choice'],
		...overrides
	});

	/** Fresh module each time: both caches are module-level and keyed for everyone alike. */
	const withCatalogue = async (models: RouterModel[]) => {
		jest.resetModules();
		const fetchMock = jest.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: models }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);
		global.fetch = fetchMock as unknown as typeof fetch;
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { openRouterProviderDefinition } = require('./ai-provider-openrouter.provider');
		return { definition: openRouterProviderDefinition, fetchMock };
	};

	const realFetch = global.fetch;
	const realEnv = process.env.OPENROUTER_FREE_MODELS;

	afterEach(() => {
		global.fetch = realFetch;
		if (realEnv === undefined) delete process.env.OPENROUTER_FREE_MODELS;
		else process.env.OPENROUTER_FREE_MODELS = realEnv;
	});

	describe('listPlatformModels (the enforced free-tier allowlist)', () => {
		it('keeps only :free slugs that can call tools', async () => {
			delete process.env.OPENROUTER_FREE_MODELS;
			const { definition } = await withCatalogue([
				model('openai/gpt-oss-20b:free'),
				// Paid: spendable on the shared account, so it must never reach this list.
				model('anthropic/claude-sonnet-5'),
				// Free but tool-less: a content-safety classifier that fails every agent turn.
				model('nvidia/nemotron-3.5-content-safety:free', { supported_parameters: ['max_tokens'] })
			]);

			const models = await definition.listPlatformModels();

			expect(models.map((entry: { id: string }) => entry.id)).toEqual(['openai/gpt-oss-20b:free']);
		});

		it('drops paid slugs from an operator override rather than trusting them', async () => {
			// The override is an allowlist for the SHARED key, held to the same rule as the fetched list.
			process.env.OPENROUTER_FREE_MODELS = 'google/gemma-4-31b-it:free, anthropic/claude-sonnet-5';
			const { definition, fetchMock } = await withCatalogue([]);

			const models = await definition.listPlatformModels();

			expect(models.map((entry: { id: string }) => entry.id)).toEqual(['google/gemma-4-31b-it:free']);
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it('returns EMPTY when an override leaves nothing free, disabling the tier', async () => {
			process.env.OPENROUTER_FREE_MODELS = 'anthropic/claude-sonnet-5';
			const { definition } = await withCatalogue([]);

			// Fails CLOSED. Falling back to the pinned list here would hand the shared account a set of
			// models the operator explicitly did not choose.
			await expect(definition.listPlatformModels()).resolves.toEqual([]);
		});

		it('falls back to the pinned free list when the catalogue cannot be reached', async () => {
			delete process.env.OPENROUTER_FREE_MODELS;
			jest.resetModules();
			global.fetch = jest.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { openRouterProviderDefinition } = require('./ai-provider-openrouter.provider');

			const models = await openRouterProviderDefinition.listPlatformModels();

			// Every entry still ends in :free — a network blip must not widen what the shared key can buy.
			expect(models.length).toBeGreaterThan(0);
			expect(models.every((entry: { id: string }) => entry.id.endsWith(':free'))).toBe(true);
		});
	});

	describe('listModels (the display catalogue)', () => {
		it('asks OpenRouter to filter by tool support and re-checks the answer', async () => {
			const { definition, fetchMock } = await withCatalogue([
				model('anthropic/claude-sonnet-5', { name: 'Anthropic: Claude Sonnet 5' }),
				// Present despite the query parameter — the re-check is what catches a server-side filter
				// being ignored or renamed.
				model('openai/whisper-large', { supported_parameters: ['max_tokens'] })
			]);

			const result: IAiChatModelList = await definition.listModels(null);

			expect(fetchMock.mock.calls[0][0]).toContain('supported_parameters=tools');
			expect(result.models.map((entry) => entry.id)).toEqual(['anthropic/claude-sonnet-5']);
			expect(result.source).toBe('live');
		});

		it('includes paid models, unlike the platform allowlist', async () => {
			const { definition } = await withCatalogue([model('anthropic/claude-opus-5')]);

			const result: IAiChatModelList = await definition.listModels(null);

			expect(result.models.map((entry) => entry.id)).toContain('anthropic/claude-opus-5');
		});

		it('fails OPEN to the curated list, where the platform list fails closed', async () => {
			jest.resetModules();
			global.fetch = jest.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { openRouterProviderDefinition } = require('./ai-provider-openrouter.provider');

			const result: IAiChatModelList = await openRouterProviderDefinition.listModels(null);

			expect(result.source).toBe('curated');
			expect(result.models.length).toBeGreaterThan(0);
		});
	});
});
