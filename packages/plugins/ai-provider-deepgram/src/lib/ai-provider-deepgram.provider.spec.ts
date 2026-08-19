import type { IAiProviderCredentials } from '@gauzy/plugin-ai-chat';
import { deepgramProviderDefinition } from './ai-provider-deepgram.provider';

/**
 * Deepgram is the one provider whose request is NOT multipart: raw bytes, container in
 * Content-Type, `Authorization: Token`. And it is voice-only — chat must be refused.
 */
describe('deepgramProviderDefinition', () => {
	const realFetch = global.fetch;
	afterEach(() => {
		global.fetch = realFetch;
		jest.restoreAllMocks();
	});

	const credentials = (overrides: Partial<IAiProviderCredentials> = {}): IAiProviderCredentials => ({
		apiKey: 'dg-secret',
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

	it('is a voice-only provider: chatCapable false, createModel throws, speech catalogue advertised', async () => {
		expect(deepgramProviderDefinition.id).toBe('deepgram');
		expect(deepgramProviderDefinition.chatCapable).toBe(false);
		expect(deepgramProviderDefinition.order).toBe(110);
		expect(deepgramProviderDefinition.speech?.defaultModel).toBe('nova-3');
		await expect(deepgramProviderDefinition.createModel('nova-3', credentials())).rejects.toThrow(/cannot serve chat/);
	});

	it('posts the raw audio to /listen with the model query, smart_format, Token auth and the container', async () => {
		const fetchMock = capture({ results: { channels: [{ alternatives: [{ transcript: '  from deepgram ' }] }] } });
		await expect(
			deepgramProviderDefinition.transcribe!(Buffer.from('audio-bytes'), 'audio/webm;codecs=opus', credentials(), {
				language: 'en'
			})
		).resolves.toBe('from deepgram');

		const [url, options] = fetchMock.mock.calls[0];
		const parsed = new URL(String(url));
		expect(parsed.origin + parsed.pathname).toBe('https://api.deepgram.com/v1/listen');
		expect(parsed.searchParams.get('model')).toBe('nova-3');
		expect(parsed.searchParams.get('smart_format')).toBe('true');
		expect(parsed.searchParams.get('language')).toBe('en');
		expect((options.headers as Record<string, string>).authorization).toBe('Token dg-secret');
		expect((options.headers as Record<string, string>)['content-type']).toBe('audio/webm;codecs=opus');
		expect(options.body).toBeInstanceOf(Uint8Array);
		expect(Buffer.from(options.body as Uint8Array).toString()).toBe('audio-bytes');
	});

	it('honours the tenant speech model and returns an empty transcript for silence', async () => {
		const fetchMock = capture({ results: { channels: [] } });
		await expect(
			deepgramProviderDefinition.transcribe!(Buffer.from('a'), 'audio/mp4', credentials(), { model: 'nova-2' })
		).resolves.toBe('');
		expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('model')).toBe('nova-2');
	});

	it('classifies a rejected key as key-rejected without echoing the body', async () => {
		capture({ err_msg: 'Invalid credentials dg-secret' }, { status: 401 });
		const error = (await deepgramProviderDefinition
			.transcribe!(Buffer.from('a'), 'audio/webm', credentials())
			.catch((e: unknown) => e)) as Error & { kind?: string };
		expect(error.kind).toBe('key-rejected');
		expect(error.message).toMatch(/^Deepgram transcription failed: the API key was rejected/);
		expect(error.message).not.toMatch(/dg-secret|Invalid credentials/);
	});
});
