import {
	MAX_TRANSCRIPTION_RESPONSE_BYTES,
	MAX_TRANSCRIPT_CHARS,
	classifySpeechHttpFailure,
	redactSecret,
	resolveAudioExtension,
	speechRequest,
	transcribeMultipart,
	transcribeViaOpenAiCompatible
} from './openai-compatible-transcribe';
import { SpeechProviderError, isSpeechProviderError } from './speech-provider-error';

// The guard's transport opens real sockets and connects through its own address check. Hand its
// requests to the `global.fetch` stub each case installs instead: only the socket layer is replaced,
// while the URL check, the DNS pre-flight and the refusal of redirects all stay real.
jest.mock('../ssrf/fetch-over-node-http', () => ({
	fetchOverNodeHttp: (input: string | URL | Request, init?: RequestInit) => global.fetch(input, init)
}));

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

	/**
	 * Answers the SSRF egress guard's DNS pre-flight with a public address, so these specs never touch
	 * the network — and so a sandbox with no resolver does not turn every case into a refusal.
	 */
	const publicResolver = () => Promise.resolve(['93.184.215.14']);

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
				resolver: publicResolver,
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
				// A LAN/loopback server needs the deployment opt-in since the SSRF egress guard went in
				// (GHSA-w3mx-m5cr-3gxp); this test is about the request shape, not about the guard.
				baseUrl: 'http://localhost:8080',
				allowPrivateHost: true,
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
			// The self-hosted case this message exists for: a local container that is not running. Needs
			// the private-endpoint opt-in now that the SSRF egress guard refuses loopback by default.
			const error = await call({ baseUrl: 'http://localhost:8000/v1', allowPrivateHost: true }).catch(
				(e: unknown) => e
			);
			expect((error as SpeechProviderError).kind).toBe('network');
			expect((error as SpeechProviderError).message).toMatch(/could not be reached/);
			expect((error as SpeechProviderError).message).toMatch(/^Example transcription failed/);
		});

		it.each([
			'http://169.254.169.254/latest/meta-data/',
			'http://localhost:8000/v1',
			'http://10.0.0.5/v1',
			'http://[::1]:8000/v1'
		])('refuses the internal endpoint %s without making a request', async (baseUrl) => {
			// The reflected half of GHSA-w3mx-m5cr-3gxp: this path relays a bounded slice of the
			// upstream body and distinguishes timeout / refused / HTTP, so an unguarded fetch here was
			// both an SSRF and a host-discovery oracle.
			const fetchMock = capture({ text: 'ok' });
			const error = await call({ baseUrl }).catch((e: unknown) => e);

			expect(isSpeechProviderError(error)).toBe(true);
			expect((error as SpeechProviderError).kind).toBe('network');
			expect((error as SpeechProviderError).message).toMatch(/not allowed/i);
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it('says nothing about the refused endpoint that a probe could read', async () => {
			capture({ text: 'ok' });
			const error = (await call({ baseUrl: 'http://10.11.12.13:9000/v1' }).catch((e: unknown) => e)) as Error;

			expect(error.message).not.toContain('10.11.12.13');
			expect(error.message).not.toContain('9000');
		});

		it('caps the transcript a tenant-configured endpoint can reflect back', async () => {
			capture({ text: 'x'.repeat(MAX_TRANSCRIPT_CHARS + 5_000) });

			await expect(call()).resolves.toHaveLength(MAX_TRANSCRIPT_CHARS);
		});

		it('refuses to buffer an oversized successful body, whether chunked or declared', async () => {
			// A 2xx `{"text": …}` far past the budget, streamed with no content-length like a chunked reply.
			const oversized = `{"text":"${'x'.repeat(MAX_TRANSCRIPTION_RESPONSE_BYTES)}"}`;
			global.fetch = jest.fn().mockImplementation(() =>
				Promise.resolve(
					new Response(
						new ReadableStream<Uint8Array>({
							start(controller) {
								controller.enqueue(new TextEncoder().encode(oversized));
								controller.close();
							}
						}),
						{ status: 200 }
					)
				)
			) as unknown as typeof fetch;
			const chunked = (await call().catch((e: unknown) => e)) as SpeechProviderError;
			expect(chunked.kind).toBe('response');
			expect(chunked.message).toMatch(/oversized response/);

			capture(
				{ text: 'short' },
				{ status: 200, headers: { 'content-length': String(MAX_TRANSCRIPTION_RESPONSE_BYTES + 1) } }
			);
			const declared = (await call().catch((e: unknown) => e)) as SpeechProviderError;
			expect(declared.kind).toBe('response');
			expect(declared.message).toMatch(/oversized response/);
		});

		it('bounds the DNS pre-flight by the request timeout, not just the HTTP request', async () => {
			const fetchMock = capture({ text: 'ok' });
			const stalled = () => new Promise<string[]>(() => undefined);

			const error = (await call({ timeoutMs: 50, resolver: stalled }).catch(
				(e: unknown) => e
			)) as SpeechProviderError;

			expect(error.kind).toBe('network');
			expect(error.message).toMatch(/no answer within/);
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it('wraps a timeout as a `network` error that says so', async () => {
			const timeout = new Error('The operation was aborted due to timeout');
			timeout.name = 'TimeoutError';
			global.fetch = jest.fn().mockRejectedValue(timeout) as unknown as typeof fetch;
			const error = await call({ timeoutMs: 5000 }).catch((e: unknown) => e);
			expect((error as SpeechProviderError).kind).toBe('network');
			expect((error as SpeechProviderError).message).toMatch(/no answer within 5s/);
		});

		it('treats a 2xx without a string `text` and unreadable JSON as response errors, never as an empty transcript', async () => {
			capture({});
			const missing = await call().catch((e: unknown) => e);
			expect((missing as SpeechProviderError).kind).toBe('response');
			expect((missing as SpeechProviderError).message).toMatch(/no transcript text/);

			capture({ text: '   spaced   ' });
			await expect(call()).resolves.toBe('spaced');

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
				providerId: 'elevenlabs',
				resolver: publicResolver
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
				resolver: publicResolver,
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
				resolver: publicResolver,
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
