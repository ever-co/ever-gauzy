import type { IAiChatModelList } from '@gauzy/plugin-ai-chat';

/**
 * The gateway catalogue is public, so this filter runs for every tenant with no credential involved —
 * and it is the only one of the six with three independent conditions to get wrong at once.
 */
describe('vercelGatewayProviderDefinition.listModels', () => {
	interface GatewayModel {
		id: string;
		type?: string;
		name?: string;
		deprecated_at?: string | number | null;
		supported_parameters?: string[];
	}

	const model = (overrides: Partial<GatewayModel> & { id: string }): GatewayModel => ({
		type: 'language',
		supported_parameters: ['max_tokens', 'tools', 'tool_choice'],
		...overrides
	});

	/** Fresh module each time: the catalogue cache is module-level and keyed 'public' for everyone. */
	const load = async (models: GatewayModel[]): Promise<IAiChatModelList> => {
		jest.resetModules();
		global.fetch = jest.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: models }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		) as unknown as typeof fetch;
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { vercelGatewayProviderDefinition } = require('./ai-provider-vercel-gateway.provider');
		return vercelGatewayProviderDefinition.listModels(null);
	};

	const realFetch = global.fetch;
	afterEach(() => {
		global.fetch = realFetch;
	});

	it('keeps a tool-capable language model', async () => {
		const result = await load([model({ id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5' })]);

		expect(result).toEqual({
			models: [{ id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', providerId: 'vercel-gateway' }],
			source: 'live',
			stale: false
		});
	});

	it.each([
		['embedding', { type: 'embedding' }],
		['image', { type: 'image' }],
		['video', { type: 'video' }],
		['reranking', { type: 'reranking' }],
		['transcription', { type: 'transcription' }],
		['realtime', { type: 'realtime' }]
	])('drops a %s model', async (_label, overrides) => {
		const result = await load([model({ id: 'vendor/thing', ...overrides })]);

		// Non-language types are ~35% of the gateway's catalogue.
		expect(result.source).toBe('curated');
	});

	it('drops a language model that cannot call tools', async () => {
		const result = await load([model({ id: 'google/gemini-omni-flash', supported_parameters: ['max_tokens'] })]);

		expect(result.source).toBe('curated');
	});

	it('drops a model whose deprecation date has PASSED', async () => {
		const result = await load([model({ id: 'openai/gpt-legacy', deprecated_at: Date.now() - 86_400_000 })]);

		expect(result.source).toBe('curated');
	});

	it('keeps a model whose deprecation is still in the FUTURE', async () => {
		// The field is a schedule, not a tombstone: the gateway sets it ahead of the retirement date
		// and the model keeps working until then. Treating any value as "gone" hid a model a tenant may
		// already have configured — their own saved default, missing from their own picker.
		const result = await load([
			model({ id: 'openai/gpt-5.3-chat', name: 'GPT-5.3 Chat', deprecated_at: Date.now() + 4 * 86_400_000 })
		]);

		expect(result.models.map((entry) => entry.id)).toContain('openai/gpt-5.3-chat');
		expect(result.source).toBe('live');
	});

	it('falls back to the curated list when the fetch fails', async () => {
		jest.resetModules();
		global.fetch = jest.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { vercelGatewayProviderDefinition } = require('./ai-provider-vercel-gateway.provider');

		const result: IAiChatModelList = await vercelGatewayProviderDefinition.listModels(null);

		expect(result.source).toBe('curated');
		expect(result.models.length).toBeGreaterThan(0);
	});
});
