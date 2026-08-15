import {
	classifySpeechHttpFailure,
	redactSecret,
	resolveAudioExtension,
	speechRequest,
	transcribeMultipart,
	transcribeViaOpenAiCompatible
} from './openai-compatible-transcribe';
import { SpeechProviderError, isSpeechProviderError } from './speech-provider-error';

/**
 * The shared speech request every STT provider plugin goes through. What matters is observable
 * only on the wire — which fields the multipart body carries, which headers, and what the thrown
 * error looks like — so the tests capture the request handed to `fetch`.
 */
describe('speech helpers', () => {
	const realFetch = global.fetch;
	afterEach(() => {
		global.fetch = realFetch;
		jest.restoreAllMocks();
	});

	/** Capture the request the helper makes, answering with `body`. A FRESH Response per call. */
	const capture = (body: unknown, init: ResponseInit = { status: 200 }) => {
		const fetchMock = jest.fn().mockImplementation(() =>
			Promise.resolve(
				new Response(typeof body === 'string' ? body : JSON.stringify(body), {
					headers: { 'content-type': 'application/json' },
					...init
				})
			)
		);
		global.fetch = fetchMock as unknown as typeof fetch;
		return fetchMock;
	};

	const requestOf = (fetchMock: jest.Mock) => {
		const [url, options] = fetchMock.mock.calls[0];
		return { url: String(url), options, form: options.body as FormData };
	};

	const audio = Buffer.from('fake-audio-bytes');

	describe('transcribeViaOpenAiCompatible', () => {
		const call = (overrides: Partial<Parameters<typeof transcribeViaOpenAiCompatible>[0]> = {}) =>
			transcribeViaOpenAiCompatible({
				baseUrl: 'https://api.example.com/v1/',
				apiKey: 'sk-secret',
				audio,
				mimeType: 'audio/webm;codecs=opus',
				model: 'whisper-large-v3',
				providerLabel: 'Example',
				providerId: 'example',
				...overrides
			});

		it('posts multipart audio + model to {baseUrl}/audio/transcriptions with a bearer header', async () => {
			const fetchMock = capture({ text: '  hello  ' });
			await expect(call()).resolves.toBe('hello');

			const { url, options, form } = requestOf(fetchMock);
			// Trailing slash on the base URL is tolerated — no `//audio`.
			expect(url).toBe('https://api.example.com/v1/audio/transcriptions');
			expect(options.method).toBe('POST');
			expect((options.headers as Record<string, string>).authorization).toBe('Bearer sk-secret');
			expect(form.get('model')).toBe('whisper-large-v3');
			expect((form.get('file') as File).name).toBe('dictation.webm');
			expect(form.has('response_format')).toBe(false);
			expect(form.has('language')).toBe(false);
		});

		it('sends NO Authorization header when there is no key (local servers reject "Bearer ")', async () => {
			const fetchMock = capture({ text: 'ok' });
			await call({ apiKey: '' });
			expect('authorization' in (requestOf(fetchMock).options.headers as Record<string, string>)).toBe(false);

			const fetchMock2 = capture({ text: 'ok' });
			await call({ apiKey: undefined });
			expect('authorization' in (requestOf(fetchMock2).options.headers as Record<string, string>)).toBe(false);
		});

		it('honours a custom path, language hint, extra fields and extra headers', async () => {
			const fetchMock = capture({ text: 'ok' });
			await call({
				path: '/v1/audio/transcriptions',
				baseUrl: 'http://localhost:8080',
				language: 'de',
				fields: { response_format: 'json' },
				headers: { 'x-custom': '1' }
			});
			const { url, options, form } = requestOf(fetchMock);
			expect(url).toBe('http://localhost:8080/v1/audio/transcriptions');
			expect(form.get('language')).toBe('de');
			expect(form.get('response_format')).toBe('json');
			expect((options.headers as Record<string, string>)['x-custom']).toBe('1');
		});

		it.each([
			[401, 'key-rejected', /API key was rejected/],
			[403, 'key-rejected', /API key was rejected/],
			[429, 'rate-limited', /rate or quota limit/],
			[400, 'audio-rejected', /audio was rejected/],
			[415, 'audio-rejected', /audio was rejected/],
			[500, 'http', /HTTP 500/]
		])('classifies HTTP %s as %s', async (status, kind, pattern) => {
			capture({ error: { message: 'whatever' } }, { status });
			const error = await call().catch((e: unknown) => e);
			expect(isSpeechProviderError(error)).toBe(true);
			expect(error).toBeInstanceOf(SpeechProviderError);
			expect((error as SpeechProviderError).kind).toBe(kind);
			expect((error as SpeechProviderError).status).toBe(status);
			expect((error as SpeechProviderError).providerId).toBe('example');
			expect((error as SpeechProviderError).message).toMatch(pattern);
			expect((error as SpeechProviderError).message).toMatch(/^Example transcription failed:/);
		});

		it('never echoes the body of a credential failure, but relays (redacted) diagnostics otherwise', async () => {
			capture({ error: { message: 'Incorrect API key provided: sk-secret' } }, { status: 401 });
			await expect(call()).rejects.not.toThrow(/sk-secret/);
			await expect(call()).rejects.not.toThrow(/Incorrect/);

			capture({ error: { message: 'Invalid file format; key azure-123 gsk_abcdef sk-zzz' } }, { status: 400 });
			const error = (await call({ apiKey: 'azure-123' }).catch((e: unknown) => e)) as Error;
			expect(error.message).toMatch(/Invalid file format/);
			expect(error.message).not.toMatch(/azure-123/);
			expect(error.message).not.toMatch(/gsk_abcdef|sk-zzz/);
			expect(error.message).toMatch(/gsk_\*\*\*/);
			expect(error.message).toMatch(/sk-\*\*\*/);
		});

		it('never relays upstream statusText', async () => {
			capture({ error: { message: 'teapot' } }, { status: 418, statusText: 'secret-in-status' });
			await expect(call()).rejects.toThrow(/HTTP 418/);
			await expect(call()).rejects.not.toThrow(/secret-in-status/);
		});

		it('wraps a network failure (server down) as a `network` error naming the provider', async () => {
			global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;
			const error = await call({ baseUrl: 'http://localhost:8000/v1' }).catch((e: unknown) => e);
			expect((error as SpeechProviderError).kind).toBe('network');
			expect((error as SpeechProviderError).message).toMatch(/could not be reached/);
			expect((error as SpeechProviderError).message).toMatch(/^Example transcription failed/);
		});

		it('wraps a timeout as a `network` error that says so', async () => {
			const timeout = new Error('The operation was aborted due to timeout');
			timeout.name = 'TimeoutError';
			global.fetch = jest.fn().mockRejectedValue(timeout) as unknown as typeof fetch;
			const error = await call({ timeoutMs: 5000 }).catch((e: unknown) => e);
			expect((error as SpeechProviderError).kind).toBe('network');
			expect((error as SpeechProviderError).message).toMatch(/no answer within 5s/);
		});

		it('treats a 2xx without `text` as an empty transcript, and unreadable JSON as a response error', async () => {
			capture({});
			await expect(call()).resolves.toBe('');

			capture('not json at all');
			const error = await call().catch((e: unknown) => e);
			expect((error as SpeechProviderError).kind).toBe('response');
		});
	});

	describe('transcribeMultipart / speechRequest', () => {
		it('lets a provider rename the file field, add fields and parse a custom body shape', async () => {
			// ElevenLabs: `file` + `model_id`, header xi-api-key, `{ text }`. whisper.cpp: `/inference`.
			const fetchMock = capture({ text: 'from eleven' });
			const text = await transcribeMultipart({
				url: 'https://api.elevenlabs.io/v1/speech-to-text',
				audio,
				mimeType: 'audio/mp4',
				fields: { model_id: 'scribe_v1', language_code: undefined },
				headers: { 'xi-api-key': 'xi-secret' },
				apiKey: 'xi-secret',
				providerLabel: 'ElevenLabs',
				providerId: 'elevenlabs'
			});
			expect(text).toBe('from eleven');
			const { options, form } = requestOf(fetchMock);
			expect(form.get('model_id')).toBe('scribe_v1');
			// undefined fields are dropped, not sent as the string "undefined".
			expect(form.has('language_code')).toBe(false);
			expect((form.get('file') as File).name).toBe('dictation.mp4');
			expect((options.headers as Record<string, string>)['xi-api-key']).toBe('xi-secret');
			expect('authorization' in (options.headers as Record<string, string>)).toBe(false);
		});

		it('speechRequest supports a raw (non-multipart) body and a custom parser — the Deepgram shape', async () => {
			const fetchMock = capture({
				results: { channels: [{ alternatives: [{ transcript: 'from deepgram' }] }] }
			});
			const text = await speechRequest({
				url: 'https://api.deepgram.com/v1/listen?model=nova-3',
				init: {
					method: 'POST',
					headers: { authorization: 'Token dg-secret', 'content-type': 'audio/webm' },
					body: new Uint8Array(audio)
				},
				apiKey: 'dg-secret',
				providerLabel: 'Deepgram',
				providerId: 'deepgram',
				parse: (body) =>
					String(
						(body as { results?: { channels?: { alternatives?: { transcript?: string }[] }[] } }).results
							?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
					)
			});
			expect(text).toBe('from deepgram');
			expect(requestOf(fetchMock).options.headers['content-type']).toBe('audio/webm');
		});

		it('a parser that throws becomes a `response` error with the key redacted', async () => {
			capture({ weird: true });
			const error = await speechRequest({
				url: 'https://x',
				init: { method: 'POST' },
				apiKey: 'dg-secret',
				providerLabel: 'X',
				parse: () => {
					throw new Error('unexpected shape (dg-secret)');
				}
			}).catch((e: unknown) => e);
			expect((error as SpeechProviderError).kind).toBe('response');
			expect((error as SpeechProviderError).message).not.toMatch(/dg-secret/);
		});
	});

	describe('pure helpers', () => {
		it.each([
			['audio/webm;codecs=opus', 'webm'],
			['audio/mp4', 'mp4'],
			['audio/mpeg', 'mp3'],
			['audio/ogg;codecs=opus', 'ogg'],
			['audio/wav', 'wav'],
			['audio/flac', 'flac'],
			['audio/x-m4a', 'm4a'],
			['', 'webm']
		])('resolveAudioExtension(%s) → %s', (mimeType, expected) => {
			expect(resolveAudioExtension(mimeType)).toBe(expected);
		});

		it('classifySpeechHttpFailure maps by status number only', () => {
			expect(classifySpeechHttpFailure(401).kind).toBe('key-rejected');
			expect(classifySpeechHttpFailure(403).kind).toBe('key-rejected');
			expect(classifySpeechHttpFailure(429).kind).toBe('rate-limited');
			expect(classifySpeechHttpFailure(400).kind).toBe('audio-rejected');
			expect(classifySpeechHttpFailure(422).kind).toBe('audio-rejected');
			expect(classifySpeechHttpFailure(502)).toEqual({ kind: 'http', reason: 'HTTP 502' });
		});

		it('redactSecret strips the exact key and key-shaped tokens, and bounds the length', () => {
			expect(redactSecret('key azure-1 sk-abc gsk_def', 'azure-1')).toBe('key [redacted] sk-*** gsk_***');
			expect(redactSecret('x'.repeat(1000)).length).toBe(300);
			// Without a key to redact it still handles the shape-based ones.
			expect(redactSecret('token sk-live-123')).toBe('token sk-***');
		});

		it('isSpeechProviderError duck-types copies from another bundle', () => {
			expect(isSpeechProviderError({ name: 'SpeechProviderError', kind: 'http', message: 'x' })).toBe(true);
			expect(isSpeechProviderError(new Error('SpeechProviderError'))).toBe(false);
			expect(isSpeechProviderError(null)).toBe(false);
		});
	});
});
