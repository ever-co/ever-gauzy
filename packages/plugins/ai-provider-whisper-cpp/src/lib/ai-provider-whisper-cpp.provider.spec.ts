import type { IAiProviderCredentials } from '@gauzy/plugin-ai-chat';
import { whisperCppProviderDefinition } from './ai-provider-whisper-cpp.provider';

/**
 * whisper.cpp is the LOCAL, key-less shape: no Authorization header when there is no key, the
 * `/inference` path (not OpenAI's), `response_format=json`, and the conventional default address.
 */
describe('whisperCppProviderDefinition', () => {
	const realFetch = global.fetch;
	afterEach(() => {
		global.fetch = realFetch;
		jest.restoreAllMocks();
	});

	const capture = (body: unknown, init: ResponseInit = { status: 200 }) => {
		const fetchMock = jest.fn().mockImplementation(() =>
			Promise.resolve(new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, ...init }))
		);
		global.fetch = fetchMock as unknown as typeof fetch;
		return fetchMock;
	};

	const noKey: IAiProviderCredentials = { apiKey: '', baseUrl: 'http://whisper.local:8080/', source: 'tenant' };

	it('is a local, key-less, voice-only provider', async () => {
		expect(whisperCppProviderDefinition.id).toBe('whisper-cpp');
		expect(whisperCppProviderDefinition.requiresApiKey).toBe(false);
		expect(whisperCppProviderDefinition.local).toBe(true);
		expect(whisperCppProviderDefinition.chatCapable).toBe(false);
		expect(whisperCppProviderDefinition.defaultBaseUrl).toBe('http://localhost:8080');
		expect(whisperCppProviderDefinition.baseUrlEnvVar).toBe('WHISPER_CPP_BASE_URL');
		await expect(whisperCppProviderDefinition.createModel('x', noKey)).rejects.toThrow(/cannot serve chat/);
	});

	it('posts multipart to {baseUrl}/inference with response_format=json and NO auth header when key-less', async () => {
		const fetchMock = capture({ text: ' hello from whisper.cpp ' });
		await expect(
			whisperCppProviderDefinition.transcribe!(Buffer.from('audio'), 'audio/webm;codecs=opus', noKey, {
				language: 'de'
			})
		).resolves.toBe('hello from whisper.cpp');

		const [url, options] = fetchMock.mock.calls[0];
		expect(String(url)).toBe('http://whisper.local:8080/inference');
		expect('authorization' in (options.headers as Record<string, string>)).toBe(false);
		const form = options.body as FormData;
		expect(form.get('response_format')).toBe('json');
		expect(form.get('temperature')).toBe('0');
		expect(form.get('language')).toBe('de');
		expect(form.has('model')).toBe(false);
		expect((form.get('file') as File).name).toBe('dictation.webm');
	});

	it('falls back to the conventional local address and forwards a key as bearer when one is set', async () => {
		const fetchMock = capture({ text: 'ok' });
		await whisperCppProviderDefinition.transcribe!(Buffer.from('audio'), 'audio/mp4', {
			apiKey: 'proxy-token',
			source: 'environment'
		});
		const [url, options] = fetchMock.mock.calls[0];
		expect(String(url)).toBe('http://localhost:8080/inference');
		expect((options.headers as Record<string, string>).authorization).toBe('Bearer proxy-token');
	});

	it('reports a server that is not running as a network failure naming the provider', async () => {
		global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;
		const error = (await whisperCppProviderDefinition
			.transcribe!(Buffer.from('audio'), 'audio/webm', noKey)
			.catch((e: unknown) => e)) as Error & { kind?: string };
		expect(error.kind).toBe('network');
		expect(error.message).toMatch(/^whisper\.cpp transcription failed: the server could not be reached/);
	});
});
