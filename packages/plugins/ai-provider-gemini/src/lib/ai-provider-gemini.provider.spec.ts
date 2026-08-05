import type { IAiChatModelList, IAiProviderCredentials } from '@gauzy/plugin-ai-chat';

/**
 * Gemini's `models.list` reports `supportedGenerationMethods` but nothing about TOOLS, so the
 * denylist below is the only filter — which is exactly why it needs a table. Image, music, robotics
 * and research-preview models all answer `generateContent` and all reached the agent's model picker.
 */
describe('geminiProviderDefinition.listModels', () => {
	const credentials = (overrides: Partial<IAiProviderCredentials> = {}): IAiProviderCredentials => ({
		apiKey: `AIza-test-${Math.random()}`,
		source: 'tenant',
		...overrides
	});

	/** Fresh module each time: the catalogue cache is module-level and would answer the next test. */
	const load = async (
		ids: string[],
		creds: IAiProviderCredentials | null = credentials()
	): Promise<{ result: IAiChatModelList; url?: string; headers?: Record<string, string>; calls: number }> => {
		jest.resetModules();
		const fetchMock = jest.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					models: ids.map((id) => ({ name: `models/${id}`, supportedGenerationMethods: ['generateContent'] }))
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		);
		global.fetch = fetchMock as unknown as typeof fetch;
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { geminiProviderDefinition } = require('./ai-provider-gemini.provider');
		const result = await geminiProviderDefinition.listModels(creds);
		const call = fetchMock.mock.calls[0];
		return { result, url: call?.[0], headers: call?.[1]?.headers, calls: fetchMock.mock.calls.length };
	};

	const realFetch = global.fetch;
	afterEach(() => {
		global.fetch = realFetch;
	});

	it.each([
		['gemini-3.5-flash', true],
		['gemini-3-pro', true],
		// Image, video and music generation — all of them answer generateContent.
		['imagen-4.0-generate-001', false],
		['veo-3.1-generate-preview', false],
		['gemini-3.1-flash-image', false],
		['lyria-3-pro-preview', false],
		['lyria-realtime-exp', false],
		// Multimodal generators that do not accept tools.
		['gemini-omni-flash-preview', false],
		// Embodied and standalone-agent previews: chat-shaped, not models this agent can drive.
		['gemini-robotics-er-2-preview', false],
		['deep-research-preview-04-2026', false],
		['antigravity-preview-05-2026', false],
		// Non-chat modalities.
		['text-embedding-004', false],
		['aqa', false],
		['learnlm-2.0-flash-experimental', false],
		['gemini-2.5-flash-preview-tts', false]
	])('%s is %s', async (id, kept) => {
		const { result } = await load([id as string]);

		expect(result.models.some((model) => model.id === id)).toBe(kept);
	});

	it('sends the key as a header, never in the URL', async () => {
		const creds = credentials();
		const { url, headers } = await load(['gemini-3.5-flash'], creds);

		// `?key=` would put a live credential into request URLs, which land in proxy and access logs.
		expect(url).not.toContain(creds.apiKey);
		expect(headers?.['x-goog-api-key']).toBe(creds.apiKey);
	});

	it('asks for more than the default page of 50', async () => {
		const { url } = await load(['gemini-3.5-flash']);

		expect(url).toContain('pageSize=1000');
	});

	it('strips the models/ resource prefix the SDK does not want', async () => {
		const { result } = await load(['gemini-3-pro']);

		expect(result.models.map((model) => model.id)).toContain('gemini-3-pro');
		expect(result.models.every((model) => !model.id.startsWith('models/'))).toBe(true);
	});

	it('keeps the curated model first and appends the rest', async () => {
		const { result } = await load(['zz-late-model', 'gemini-3.5-flash']);

		expect(result.source).toBe('live');
		expect(result.models[0].id).toBe('gemini-3.5-flash');
		expect(result.models.filter((model) => model.id === 'gemini-3.5-flash')).toHaveLength(1);
	});

	it('never calls the vendor when a custom base URL is configured', async () => {
		const { result, calls } = await load(['gemini-3.5-flash'], credentials({ baseUrl: 'https://proxy.internal' }));

		expect(calls).toBe(0);
		expect(result.source).toBe('curated');
	});
});
