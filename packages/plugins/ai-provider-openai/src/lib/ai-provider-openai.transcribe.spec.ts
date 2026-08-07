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
		const fetchMock = jest.fn().mockResolvedValue(
			new Response(JSON.stringify(body), {
				headers: { 'content-type': 'application/json' },
				...init
			})
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
});
