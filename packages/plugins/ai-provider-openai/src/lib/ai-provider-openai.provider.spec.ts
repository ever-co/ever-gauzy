import type { IAiChatModelList, IAiProviderCredentials } from '@gauzy/plugin-ai-chat';

/**
 * The catalogue filter is a pure function of a canned response body, which is exactly the shape of
 * bug that shipped here twice: `^gpt-image` never matched `chatgpt-image-latest`, and
 * `^(davinci|…)` never matched `text-davinci-003`. Both would have been a one-line table entry.
 *
 * Driven through `definition.listModels` rather than the private filter, so the credential rules in
 * `keyedCatalogue` are covered too — including the one that matters, that a custom base URL means
 * the vendor is never called.
 */
describe('openAiProviderDefinition.listModels', () => {
	const credentials = (overrides: Partial<IAiProviderCredentials> = {}): IAiProviderCredentials => ({
		apiKey: `sk-test-${Math.random()}`,
		source: 'tenant',
		...overrides
	});

	/** Fresh module each time: the catalogue cache is module-level and would answer the next test. */
	const load = async (
		ids: string[],
		creds: IAiProviderCredentials | null = credentials()
	): Promise<{ result: IAiChatModelList; calls: number }> => {
		jest.resetModules();
		const fetchMock = jest.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);
		global.fetch = fetchMock as unknown as typeof fetch;
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { openAiProviderDefinition } = require('./ai-provider-openai.provider');
		const result = await openAiProviderDefinition.listModels(creds);
		return { result, calls: fetchMock.mock.calls.length };
	};

	const realFetch = global.fetch;
	afterEach(() => {
		global.fetch = realFetch;
	});

	it.each([
		// [id, kept?] — every entry here is a model OpenAI has actually listed.
		['gpt-5.5', true],
		['gpt-4.1-mini', true],
		['o3', true],
		['chatgpt-4o-latest', true],
		// Image generation. `chatgpt-image-latest` is the one an anchored ^gpt-image let through.
		['gpt-image-2', false],
		['chatgpt-image-latest', false],
		['dall-e-3', false],
		// Completions-only: no tool calling, so it fails on the agent's first turn.
		['gpt-3.5-turbo-instruct', false],
		// The legacy completion families are prefixed, which an anchored regex never matched.
		['text-davinci-003', false],
		['code-davinci-002', false],
		['text-babbage-001', false],
		// Non-chat modalities.
		['text-embedding-3-large', false],
		['whisper-1', false],
		['tts-1-hd', false],
		['omni-moderation-latest', false],
		['gpt-4o-realtime-preview', false],
		['gpt-4o-audio-preview', false],
		['gpt-4o-transcribe', false],
		['gpt-4o-search-preview', false]
	])('%s is %s', async (id, kept) => {
		const { result } = await load([id as string]);

		expect(result.models.some((model) => model.id === id)).toBe(kept);
	});

	it('keeps the curated models first and appends the rest', async () => {
		const { result } = await load(['zz-late-model', 'gpt-5.5']);

		expect(result.source).toBe('live');
		expect(result.models[0].id).toBe('gpt-5.5');
		expect(result.models.map((model) => model.id)).toContain('zz-late-model');
		// Curated ids appear once, not twice.
		expect(result.models.filter((model) => model.id === 'gpt-5.5')).toHaveLength(1);
	});

	it('never calls the vendor when a custom base URL is configured', async () => {
		const { result, calls } = await load(['gpt-5.5'], credentials({ baseUrl: 'https://proxy.internal/v1' }));

		// The key belongs to the proxy. Sending it to api.openai.com would hand a third party a
		// credential it never issued.
		expect(calls).toBe(0);
		expect(result.source).toBe('curated');
	});

	it('falls back to the curated list without a credential', async () => {
		const { result, calls } = await load(['gpt-5.5'], null);

		expect(calls).toBe(0);
		expect(result).toEqual({
			models: expect.arrayContaining([expect.objectContaining({ id: 'gpt-5.5' })]),
			source: 'curated'
		});
	});
});
