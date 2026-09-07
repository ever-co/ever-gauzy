import type { IAiProviderCredentials } from '@gauzy/plugin-ai-chat';
import { groqProviderDefinition } from './ai-provider-groq.provider';

/**
 * Groq's speech path is the shared OpenAI-compatible helper pointed at Groq's host: what matters is
 * the URL, the bearer header, the model field and that the definition advertises its speech
 * catalogue — all observable only on the wire.
 */
describe('groqProviderDefinition', () => {
	const realFetch = global.fetch;
	afterEach(() => {
		global.fetch = realFetch;
		jest.restoreAllMocks();
	});

	const credentials = (overrides: Partial<IAiProviderCredentials> = {}): IAiProviderCredentials => ({
		apiKey: 'gsk_test',
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

	it('declares chat + speech with the expected defaults and ordering', () => {
		expect(groqProviderDefinition.id).toBe('groq');
		expect(groqProviderDefinition.order).toBe(80);
		expect(groqProviderDefinition.chatCapable).not.toBe(false);
		expect(typeof groqProviderDefinition.transcribe).toBe('function');
		expect(groqProviderDefinition.speech?.defaultModel).toBe('whisper-large-v3-turbo');
		expect(groqProviderDefinition.apiKeyEnvVars).toEqual(['GROQ_API_KEY']);
		expect(groqProviderDefinition.baseUrlEnvVar).toBe('GROQ_BASE_URL');
	});

	it('transcribes through Groq\'s OpenAI-shaped endpoint with the default speech model', async () => {
		const fetchMock = capture({ text: 'hi from groq' });
		await expect(
			groqProviderDefinition.transcribe!(Buffer.from('audio'), 'audio/webm;codecs=opus', credentials())
		).resolves.toBe('hi from groq');

		const [url, options] = fetchMock.mock.calls[0];
		expect(String(url)).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
		expect((options.headers as Record<string, string>).authorization).toBe('Bearer gsk_test');
		expect((options.body as FormData).get('model')).toBe('whisper-large-v3-turbo');
		expect(((options.body as FormData).get('file') as File).name).toBe('dictation.webm');
	});

	it('honours the tenant speech model, language and a custom base URL', async () => {
		const fetchMock = capture({ text: 'ok' });
		await groqProviderDefinition.transcribe!(
			Buffer.from('audio'),
			'audio/mp4',
			credentials({ baseUrl: 'https://groq-proxy.example.com/openai/v1/' }),
			{ model: 'whisper-large-v3', language: 'es' }
		);
		const [url, options] = fetchMock.mock.calls[0];
		expect(String(url)).toBe('https://groq-proxy.example.com/openai/v1/audio/transcriptions');
		expect((options.body as FormData).get('model')).toBe('whisper-large-v3');
		expect((options.body as FormData).get('language')).toBe('es');
	});

	it('classifies a rejected key without echoing it', async () => {
		capture({ error: { message: 'Invalid API Key gsk_test' } }, { status: 401 });
		const error = (await groqProviderDefinition
			.transcribe!(Buffer.from('audio'), 'audio/webm', credentials())
			.catch((e: unknown) => e)) as Error & { kind?: string };
		expect(error.kind).toBe('key-rejected');
		expect(error.message).toMatch(/^Groq transcription failed: the API key was rejected/);
		expect(error.message).not.toMatch(/gsk_test/);
	});
});
