import { importEsm } from '@gauzy/plugin-ai-chat';
import type { IAiProviderCredentials } from '@gauzy/plugin-ai-chat';
import { openAiCompatibleProviderDefinition } from './ai-provider-openai-compatible.provider';

// `createModel` loads the AI SDK through `importEsm`; stubbing only that loader lets a spec inspect the
// options handed to the SDK factory while every other helper (the SSRF guard included) stays real.
jest.mock('@gauzy/plugin-ai-chat', () => ({
	...jest.requireActual('@gauzy/plugin-ai-chat'),
	importEsm: jest.fn()
}));
const importEsmMock = importEsm as unknown as jest.Mock;

// The SSRF egress guard resolves the provider host before the mocked `fetch` answers. Answer that
// lookup with a fixed public address, so no case waits on — or depends on — real DNS.
jest.mock('dns', () => ({
	...jest.requireActual('dns'),
	lookup: (_hostname: string, _options: unknown, callback: (error: null, addresses: unknown) => void) =>
		callback(null, [{ address: '93.184.215.14', family: 4 }])
}));

/**
 * The generic OpenAI-compatible provider has NO vendor host: everything hangs off the tenant's
 * base URL, the key is optional, and the two hard requirements (a base URL, a chosen model) must
 * fail loudly with an actionable message.
 */
describe('openAiCompatibleProviderDefinition', () => {
	const realFetch = global.fetch;
	afterEach(() => {
		global.fetch = realFetch;
		jest.restoreAllMocks();
	});

	const credentials = (overrides: Partial<IAiProviderCredentials> = {}): IAiProviderCredentials => ({
		apiKey: '',
		source: 'tenant',
		...overrides
	});

	const capture = (body: unknown, init: ResponseInit = { status: 200 }) => {
		const fetchMock = jest.fn().mockImplementation(() =>
			Promise.resolve(new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, ...init }))
		);
		global.fetch = fetchMock as unknown as typeof fetch;
		return fetchMock;
	};

	it('declares a key-less, base-URL-required local provider with chat + speech', () => {
		expect(openAiCompatibleProviderDefinition.id).toBe('openai-compatible');
		expect(openAiCompatibleProviderDefinition.requiresApiKey).toBe(false);
		expect(openAiCompatibleProviderDefinition.requiresBaseUrl).toBe(true);
		expect(openAiCompatibleProviderDefinition.local).toBe(true);
		expect(openAiCompatibleProviderDefinition.chatCapable).not.toBe(false);
		expect(typeof openAiCompatibleProviderDefinition.transcribe).toBe('function');
		expect(openAiCompatibleProviderDefinition.speech?.defaultModel).toBe('whisper-1');
		expect(openAiCompatibleProviderDefinition.apiKeyEnvVars).toEqual(['OPENAI_COMPATIBLE_API_KEY']);
		expect(openAiCompatibleProviderDefinition.baseUrlEnvVar).toBe('OPENAI_COMPATIBLE_BASE_URL');
	});

	it('transcribes against the tenant base URL WITHOUT an authorization header when no key is set', async () => {
		const fetchMock = capture({ text: 'local transcript' });
		await expect(
			openAiCompatibleProviderDefinition.transcribe!(
				Buffer.from('audio'),
				'audio/webm',
				credentials({ baseUrl: 'http://vllm.internal:8000/v1/' })
			)
		).resolves.toBe('local transcript');
		const [url, options] = fetchMock.mock.calls[0];
		expect(String(url)).toBe('http://vllm.internal:8000/v1/audio/transcriptions');
		expect((options.headers as Record<string, string>).authorization).toBeUndefined();
		expect((options.body as FormData).get('model')).toBe('whisper-1');
	});

	it('sends the bearer header and the tenant speech model when they are configured', async () => {
		const fetchMock = capture({ text: 'ok' });
		await openAiCompatibleProviderDefinition.transcribe!(
			Buffer.from('audio'),
			'audio/mp4',
			credentials({ apiKey: 'local-token', baseUrl: 'http://localai:8080/v1' }),
			{ model: 'whisper-large', language: 'de' }
		);
		const [, options] = fetchMock.mock.calls[0];
		expect((options.headers as Record<string, string>).authorization).toBe('Bearer local-token');
		expect((options.body as FormData).get('model')).toBe('whisper-large');
		expect((options.body as FormData).get('language')).toBe('de');
	});

	it('refuses to transcribe or create a chat model without a base URL', async () => {
		await expect(
			openAiCompatibleProviderDefinition.transcribe!(Buffer.from('audio'), 'audio/webm', credentials())
		).rejects.toThrow(/no base URL is configured/);
		await expect(openAiCompatibleProviderDefinition.createModel('llama3', credentials())).rejects.toThrow(
			/needs a base URL/
		);
	});

	it('refuses to create a chat model without a chosen model id', async () => {
		await expect(
			openAiCompatibleProviderDefinition.createModel('', credentials({ baseUrl: 'http://localhost:11434/v1' }))
		).rejects.toThrow(/no default model/);
	});

	describe('chat traffic to a tenant base URL (GHSA-w3mx-m5cr-3gxp)', () => {
		const sdkFactory = () => {
			const factory = jest.fn().mockReturnValue({ chatModel: jest.fn().mockReturnValue({}) });
			importEsmMock.mockResolvedValue({ createOpenAICompatible: factory });
			return factory;
		};

		it('hands the SDK a guarded fetch, so a chat turn cannot reach an internal host', async () => {
			const factory = sdkFactory();
			await openAiCompatibleProviderDefinition.createModel(
				'llama3',
				credentials({ baseUrl: 'http://metadata.example.com/v1' })
			);

			const { fetch: sdkFetch } = factory.mock.calls[0][0] as { fetch?: typeof fetch };
			expect(typeof sdkFetch).toBe('function');

			// This spec's `dns.lookup` answers with a public address, so use a literal internal target.
			const fetchMock = capture({});
			await expect(
				sdkFetch!('http://169.254.169.254/latest/meta-data/chat/completions', { method: 'POST' })
			).rejects.toThrow(/not allowed/);
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it('leaves an operator-configured endpoint on the SDK default transport', async () => {
			const factory = sdkFactory();
			await openAiCompatibleProviderDefinition.createModel(
				'llama3',
				credentials({ baseUrl: 'http://localhost:11434/v1', source: 'environment' })
			);

			expect(factory.mock.calls[0][0].fetch).toBeUndefined();
		});
	});
});
