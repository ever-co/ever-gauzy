import type { IAiProviderCredentials } from '@gauzy/plugin-ai-chat';
import { openAiProviderDefinition } from './ai-provider-openai.provider';

/**
 * Dictation reached the user broken twice, and both defects were in the request this builds:
 *
 *  - `response_format: 'text'` was sent. `gpt-4o-mini-transcribe` accepts ONLY `json` and rejects
 *    anything else outright, so every dictation failed. (whisper-1 does support `text`, which is
 *    what made it look right.)
 *  - the filename extension is what OpenAI uses to decide the container; a generic name is rejected
 *    with "Invalid file format" even when the bytes are fine.
 *
 * Neither is visible from the call site, and neither breaks a build. They are only observable in the
 * multipart body that goes over the wire — so that is what these tests read, by capturing the
 * FormData handed to `fetch`.
 */
describe('openAiProviderDefinition.transcribe', () => {
	const realFetch = global.fetch;
	afterEach(() => {
		global.fetch = realFetch;
		jest.restoreAllMocks();
	});

	const credentials = (overrides: Partial<IAiProviderCredentials> = {}): IAiProviderCredentials => ({
		apiKey: 'sk-test-transcribe',
		source: 'tenant',
		...overrides
	});

	/** Capture the request the provider makes, answering with `body`. */
	const capture = (body: unknown, init: ResponseInit = { status: 200 }) => {
		// A FRESH Response per call: a Response body is one-shot, and `mockResolvedValue` would hand
		// every call the same instance — the second read then rejects with undici's credential-free
		// "Body is unusable", which made the credential-leak assertion below pass against an
		// implementation that echoes the body. (Mutation-tested: `mockResolvedValue` let exactly that
		// defect through.)
		const fetchMock = jest.fn().mockImplementation(() =>
			Promise.resolve(
				new Response(JSON.stringify(body), {
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

	const transcribe = (mimeType = 'audio/webm;codecs=opus', creds = credentials()) =>
		openAiProviderDefinition.transcribe!(Buffer.from('fake-audio-bytes'), mimeType, creds);

	it('never sends response_format — the model accepts only the default', async () => {
		// THE regression. Asking for `text` is rejected outright, so this assertion is the difference
		// between dictation working and every attempt failing.
		const fetchMock = capture({ text: 'hello world' });
		await transcribe();

		expect(requestOf(fetchMock).form.has('response_format')).toBe(false);
	});

	it('posts the audio to /audio/transcriptions with the key and the speech model', async () => {
		const fetchMock = capture({ text: 'hello world' });
		await transcribe();

		const { url, options, form } = requestOf(fetchMock);
		expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
		expect(options.method).toBe('POST');
		expect((options.headers as Record<string, string>).authorization).toBe('Bearer sk-test-transcribe');
		expect(form.get('model')).toBe('gpt-4o-mini-transcribe');
		// No language hint unless the caller passes one: an empty `language` field is rejected.
		expect(form.has('language')).toBe(false);
	});

	it('honours the tenant-chosen speech model and language hint', async () => {
		// The speech model used to be a hardcoded constant; the settings page now lets a tenant pick
		// one per provider and the engine passes it through `options.model`.
		const fetchMock = capture({ text: 'bonjour' });
		await openAiProviderDefinition.transcribe!(Buffer.from('fake-audio-bytes'), 'audio/webm', credentials(), {
			model: 'whisper-1',
			language: 'fr'
		});

		const { form } = requestOf(fetchMock);
		expect(form.get('model')).toBe('whisper-1');
		expect(form.get('language')).toBe('fr');
	});

	it('advertises its speech catalogue with the default model first', () => {
		expect(openAiProviderDefinition.speech?.defaultModel).toBe('gpt-4o-mini-transcribe');
		expect(openAiProviderDefinition.speech?.models.map((model) => model.id)).toEqual([
			'gpt-4o-mini-transcribe',
			'gpt-4o-transcribe',
			'whisper-1'
		]);
	});

	it.each([
		// [browser mimeType, expected filename] — OpenAI reads the CONTAINER off the extension, so a
		// generic name is rejected even when the bytes are valid. webm/mp4/ogg are what MediaRecorder
		// actually produces across Chrome/Firefox and Safari; audio/mpeg (an MP3 fed in by a future
		// file-upload path) must map to .mp3 — the first version of this table expected .mp4 for it,
		// which would have told OpenAI that MP3 bytes were an MP4 container.
		['audio/webm;codecs=opus', 'dictation.webm'],
		['audio/mp4', 'dictation.mp4'],
		['audio/mpeg', 'dictation.mp3'],
		['audio/ogg;codecs=opus', 'dictation.ogg'],
		// The rest of the pre-recorded-file class: every container OpenAI accepts that a MIME type can
		// name. Raw `audio/aac` stays on the webm fallback — OpenAI's accepted set has no extension
		// for it, so no mapping could save it.
		['audio/wav', 'dictation.wav'],
		['audio/flac', 'dictation.flac'],
		['audio/x-m4a', 'dictation.m4a'],
		['', 'dictation.webm']
	])('names the upload from the %s container', async (mimeType, expected) => {
		const fetchMock = capture({ text: 'ok' });
		await transcribe(mimeType);

		const file = requestOf(fetchMock).form.get('file') as File;
		expect(file.name).toBe(expected);
	});

	it('returns the transcript, trimmed', async () => {
		capture({ text: '  hello world  ' });
		await expect(transcribe()).resolves.toBe('hello world');
	});

	it('treats silence as an empty transcript rather than an error', async () => {
		// A recording with nothing in it is a valid answer: the user pressed the mic and said nothing.
		// Throwing here would surface as a failed dictation and send them looking at their API key.
		capture({});
		await expect(transcribe()).resolves.toBe('');
	});

	it('honours a custom base URL', async () => {
		// Unlike the model catalogue, which deliberately never calls a custom endpoint: the caller
		// configured this as their OpenAI and explicitly asked for this request.
		const fetchMock = capture({ text: 'ok' });
		await transcribe('audio/webm', credentials({ baseUrl: 'https://proxy.example.com/v1/' }));

		expect(requestOf(fetchMock).url).toBe('https://proxy.example.com/v1/audio/transcriptions');
	});

	it('classifies a failure by status without echoing the upstream body, which carries the credential', async () => {
		capture({ error: { message: 'Incorrect API key provided: sk-test-transcribe' } }, { status: 401 });

		// Classified, not the bare status: the chat panel shows this verbatim, and "401" told the user
		// nothing while "check your API key" was being appended to every failure class downstream.
		await expect(transcribe()).rejects.toThrow(/API key was rejected/);
		await expect(transcribe()).rejects.not.toThrow(/sk-test-transcribe/);
	});

	it('does not blame the API key for a quota failure', async () => {
		capture({ error: { message: 'Rate limit reached' } }, { status: 429 });

		await expect(transcribe()).rejects.toThrow(/rate or quota limit/);
		await expect(transcribe()).rejects.not.toThrow(/API key/);
	});

	it('relays the diagnostic body for a format failure, with key-shaped tokens redacted', async () => {
		// Non-credential failures DO include the upstream body — "Invalid file format" is the one
		// message that tells the user what to change — but defensively redacted: a proxy that routes
		// a secret into a 400 must not put it on screen.
		capture({ error: { message: 'Invalid file format for sk-oops-leaked' } }, { status: 400 });

		await expect(transcribe()).rejects.toThrow(/audio was rejected/);
		await expect(transcribe()).rejects.toThrow(/Invalid file format/);
		await expect(transcribe()).rejects.not.toThrow(/sk-oops-leaked/);
	});

	it('redacts the exact key in use even when it is not sk-shaped', async () => {
		// Custom base URLs (Azure, proxies) issue keys with no recognizable prefix, so shape-based
		// redaction alone would relay exactly the secret it exists to protect.
		capture({ error: { message: 'key azure-key-123 is over quota' } }, { status: 429 });

		const creds = credentials({ apiKey: 'azure-key-123', baseUrl: 'https://proxy.example.com/v1' });
		await expect(transcribe('audio/webm', creds)).rejects.toThrow(/rate or quota limit/);
		await expect(transcribe('audio/webm', creds)).rejects.not.toThrow(/azure-key-123/);
	});

	it('never relays upstream statusText', async () => {
		// statusText is upstream-controlled prose; with a custom base URL, upstream is whatever the
		// tenant configured. The classified reason uses the status NUMBER only.
		capture({ error: { message: 'teapot' } }, { status: 418, statusText: 'secret-in-status sk-via-status' });

		await expect(transcribe()).rejects.toThrow(/HTTP 418/);
		await expect(transcribe()).rejects.not.toThrow(/secret-in-status/);
	});
});
