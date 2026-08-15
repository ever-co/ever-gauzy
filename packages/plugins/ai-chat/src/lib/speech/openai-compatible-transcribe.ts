/**
 * Shared speech-to-text plumbing for provider plugins.
 *
 * Nearly every STT API is "POST multipart audio, get `{ text }` back" — OpenAI, Groq, Mistral,
 * Speaches, LocalAI and any OpenAI-compatible gateway literally share the `/audio/transcriptions`
 * shape, ElevenLabs and whisper.cpp differ only in field names — so the request, the bounded error
 * read, the secret redaction and the failure classification live here ONCE. A provider plugin
 * supplies its endpoint, its auth header and its model, and gets back either a transcript or a
 * {@link SpeechProviderError} whose `kind` the chat engine can act on without regex-sniffing prose.
 */

import { SpeechProviderError, SpeechProviderErrorKind } from './speech-provider-error';

/**
 * Upstream budget for a transcription.
 *
 * Longer than a catalogue fetch on purpose: a minute of speech takes real time to process, and the
 * user is watching a spinner they started deliberately rather than a background refresh.
 */
export const TRANSCRIBE_TIMEOUT_MS = 60_000;

/**
 * Upper bound on the upstream error body read for a diagnostic message.
 *
 * Far more than any real API error needs, and small enough that a custom base URL answering with
 * an arbitrarily large body cannot make this process buffer it: `response.text()` reads EVERYTHING
 * before a display-side `slice` ever runs, so the bound has to be applied while reading.
 */
export const MAX_ERROR_DETAIL_BYTES = 2048;

/** Read at most `maxBytes` of a response body, then cancel the rest of the stream. */
export const readBounded = async (response: globalThis.Response, maxBytes: number): Promise<string> => {
	const reader = response.body?.getReader();
	if (!reader) return '';
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (total < maxBytes) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
			total += value.byteLength;
		}
	} catch {
		/* a broken error-body stream must not mask the error being reported */
	} finally {
		reader.cancel().catch(() => undefined);
	}
	const merged = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		merged.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(merged.subarray(0, maxBytes)).trim();
};

/**
 * Strip the credential in use and anything key-shaped from text bound for the user.
 *
 * Both patterns matter: OpenAI keys are `sk-…`, but a custom base URL (Azure, a proxy) issues keys
 * with no recognizable prefix — only redacting by shape would relay exactly the secret this exists
 * to protect. Display-truncated at the end so the redaction cannot be sliced through mid-token.
 */
export const redactSecret = (text: string, apiKey?: string): string =>
	(apiKey ? text.split(apiKey).join('[redacted]') : text)
		// OpenAI-style `sk-…` and Groq-style `gsk_…` keys, wherever they appear.
		.replace(/\b(g?sk[-_])[A-Za-z0-9_-]+/g, '$1***')
		.slice(0, 300)
		.trim();

/**
 * Container extension for the multipart filename, derived from the MIME type the browser recorded.
 *
 * `/v1/audio/transcriptions` decides the container from the filename EXTENSION, so a generic name is
 * rejected with "Invalid file format" even when the bytes are fine. `webm` is the fallback: it is
 * what `MediaRecorder` produces by default everywhere except Safari.
 */
export const resolveAudioExtension = (mimeType: string): string => {
	// `audio/mpeg` is MP3, not MP4 — lumping it in with `mp4` named MP3 bytes `dictation.mp4`, and the
	// extension is exactly what OpenAI trusts to identify the container. MediaRecorder never produces
	// audio/mpeg, which is why this survived: it only bites when a caller feeds a pre-recorded file.
	// wav/flac/m4a are covered for the same caller class — every container OpenAI accepts that a MIME
	// type can name. What remains falling to `.webm` (e.g. raw `audio/aac`) has no extension in
	// OpenAI's accepted set at all, so no mapping could save it.
	if (mimeType.includes('mp4')) {
		return 'mp4';
	}
	if (mimeType.includes('mpeg')) {
		return 'mp3';
	}
	if (mimeType.includes('ogg')) {
		return 'ogg';
	}
	if (mimeType.includes('wav')) {
		return 'wav';
	}
	if (mimeType.includes('flac')) {
		return 'flac';
	}
	if (mimeType.includes('m4a')) {
		// audio/m4a and audio/x-m4a
		return 'm4a';
	}
	return 'webm';
};

/**
 * Classify a non-2xx speech response by STATUS NUMBER only.
 *
 * statusText is upstream-controlled prose, and a custom base URL means upstream is whatever the
 * tenant configured, so it gets no free ride into a user-visible message.
 */
export const classifySpeechHttpFailure = (status: number): { kind: SpeechProviderErrorKind; reason: string } => {
	if (status === 401 || status === 403) {
		return { kind: 'key-rejected', reason: 'the API key was rejected' };
	}
	if (status === 429) {
		return { kind: 'rate-limited', reason: 'the rate or quota limit was hit' };
	}
	if (status === 400 || status === 415 || status === 422) {
		return { kind: 'audio-rejected', reason: 'the audio was rejected (unsupported or empty recording)' };
	}
	return { kind: 'http', reason: `HTTP ${status}` };
};

/** Trim a trailing slash so `${base}/path` never doubles it. */
export const trimTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

/** Base arguments shared by every speech request helper. */
export interface ISpeechRequestBase {
	/** Human-readable provider name used in error messages ("OpenAI transcription failed: …"). */
	providerLabel: string;
	/** Registry id, attached to the thrown {@link SpeechProviderError}. */
	providerId?: string;
	/** Credential in use, redacted from any relayed error body. Empty/undefined = none. */
	apiKey?: string;
	/** Upstream budget. Defaults to {@link TRANSCRIBE_TIMEOUT_MS}. */
	timeoutMs?: number;
}

/** Arguments of {@link speechRequest}. */
export interface ISpeechRequestArgs extends ISpeechRequestBase {
	url: string;
	init: RequestInit;
	/**
	 * Turn the parsed 2xx JSON body into the transcript. Defaults to reading `text`. Throw to signal a
	 * malformed body — it is wrapped as a `response`-kind error.
	 */
	parse?: (body: unknown) => string;
}

/**
 * Perform one speech HTTP request and return the transcript, or throw a {@link SpeechProviderError}.
 *
 * Handles what every provider would otherwise re-implement: the timeout, network failures, the
 * status-based classification, the bounded + redacted error body (never relayed on a credential
 * failure, whose body echoes the key back), and JSON parsing of the success body.
 */
export async function speechRequest(args: ISpeechRequestArgs): Promise<string> {
	const { url, providerLabel, providerId, apiKey, parse } = args;
	const timeoutMs = args.timeoutMs ?? TRANSCRIBE_TIMEOUT_MS;

	let response: globalThis.Response;
	try {
		response = await fetch(url, { ...args.init, signal: args.init.signal ?? AbortSignal.timeout(timeoutMs) });
	} catch (error) {
		// No HTTP answer at all: DNS, connection refused (a local server that is not running is the
		// common case), TLS, or the timeout above. The message names the failure — a self-hoster needs
		// to know their container is down — but is redacted and bounded like everything else.
		const detail = redactSecret(error instanceof Error ? error.message : String(error), apiKey);
		const timedOut = error instanceof Error && error.name === 'TimeoutError';
		throw new SpeechProviderError(
			`${providerLabel} transcription failed: ${
				timedOut ? `no answer within ${Math.round(timeoutMs / 1000)}s` : 'the server could not be reached'
			}${detail ? ` — ${detail}` : ''}`,
			'network',
			providerId
		);
	}

	if (!response.ok) {
		// The bare status code was reaching the user as "check your API key" for EVERY failure class,
		// including quota and bad audio. Classify by status so the message is actionable.
		const { kind, reason } = classifySpeechHttpFailure(response.status);
		// The response body is genuinely diagnostic for format/limit errors ("Invalid file format"),
		// so it is relayed — but NEVER on a credential failure, whose body echoes the API key back
		// ("Incorrect API key provided: sk-…"). Redacted of both key-shaped tokens AND the exact key
		// in use (custom endpoints issue keys with no sk- prefix), and read BOUNDED: `.text()` would
		// buffer however much the upstream cares to send before the display truncation ever ran.
		const detail =
			kind === 'key-rejected' ? '' : redactSecret(await readBounded(response, MAX_ERROR_DETAIL_BYTES), apiKey);
		throw new SpeechProviderError(
			`${providerLabel} transcription failed: ${reason}${detail ? ` — ${detail}` : ''}`,
			kind,
			providerId,
			response.status
		);
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch (error) {
		throw new SpeechProviderError(
			`${providerLabel} transcription failed: the server returned an unreadable response`,
			'response',
			providerId,
			response.status
		);
	}
	try {
		const text = parse ? parse(body) : String((body as { text?: unknown })?.text ?? '');
		return text.trim();
	} catch (error) {
		throw new SpeechProviderError(
			`${providerLabel} transcription failed: ${redactSecret(
				error instanceof Error ? error.message : 'unexpected response shape',
				apiKey
			)}`,
			'response',
			providerId,
			response.status
		);
	}
}

/** Arguments of {@link transcribeMultipart}. */
export interface ITranscribeMultipartArgs extends ISpeechRequestBase {
	/** Full endpoint URL. */
	url: string;
	audio: Buffer;
	mimeType: string;
	/** Multipart field carrying the audio. Defaults to `file`. */
	fileField?: string;
	/** Additional multipart fields (`model`, `model_id`, `response_format`, `language`, …). */
	fields?: Record<string, string | undefined>;
	/** Request headers (auth etc.). `Content-Type` is set by fetch from the FormData boundary. */
	headers?: Record<string, string>;
	/** See {@link ISpeechRequestArgs.parse}. */
	parse?: (body: unknown) => string;
}

/**
 * POST a multipart transcription request. The filename EXTENSION is derived from the browser's MIME
 * type because most servers decide the container from it (see {@link resolveAudioExtension}).
 */
export async function transcribeMultipart(args: ITranscribeMultipartArgs): Promise<string> {
	const form = new FormData();
	const extension = resolveAudioExtension(args.mimeType);
	form.append(
		args.fileField ?? 'file',
		new Blob([new Uint8Array(args.audio)], { type: args.mimeType }),
		`dictation.${extension}`
	);
	for (const [name, value] of Object.entries(args.fields ?? {})) {
		if (value !== undefined && value !== '') form.append(name, value);
	}
	return speechRequest({
		url: args.url,
		init: { method: 'POST', headers: args.headers ?? {}, body: form },
		providerLabel: args.providerLabel,
		providerId: args.providerId,
		apiKey: args.apiKey,
		timeoutMs: args.timeoutMs,
		parse: args.parse
	});
}

/** Arguments of {@link transcribeViaOpenAiCompatible}. */
export interface ITranscribeViaOpenAiCompatibleArgs extends ISpeechRequestBase {
	/** API base including the version segment (`https://api.openai.com/v1`, `http://localhost:8000/v1`). */
	baseUrl: string;
	audio: Buffer;
	mimeType: string;
	/** Speech model id sent as the `model` field. */
	model: string;
	/** Endpoint path under `baseUrl`. Defaults to `/audio/transcriptions`. */
	path?: string;
	/** Extra headers merged after the `Authorization` header. */
	headers?: Record<string, string>;
	/** Optional ISO-639-1 language hint (`language` field). */
	language?: string;
	/** Extra form fields for servers that want them (e.g. `response_format`). */
	fields?: Record<string, string | undefined>;
}

/**
 * Speech-to-text through an OpenAI-shaped `POST {baseUrl}/audio/transcriptions` endpoint.
 *
 * Used verbatim by OpenAI, Groq, Mistral, Speaches, LocalAI and any OpenAI-compatible gateway. The
 * `Authorization: Bearer` header is only sent when there IS a key — local servers commonly run
 * without one, and `Bearer ` (empty) is rejected by some of them.
 *
 * No `response_format` unless the caller asks: OpenAI's `gpt-4o-*-transcribe` models accept ONLY
 * `json` (the default) and reject `text` outright, so sending it would fail every dictation.
 */
export async function transcribeViaOpenAiCompatible(args: ITranscribeViaOpenAiCompatibleArgs): Promise<string> {
	const url = `${trimTrailingSlash(args.baseUrl)}${args.path ?? '/audio/transcriptions'}`;
	return transcribeMultipart({
		url,
		audio: args.audio,
		mimeType: args.mimeType,
		fields: { model: args.model, language: args.language, ...(args.fields ?? {}) },
		headers: {
			...(args.apiKey ? { authorization: `Bearer ${args.apiKey}` } : {}),
			...(args.headers ?? {})
		},
		providerLabel: args.providerLabel,
		providerId: args.providerId,
		apiKey: args.apiKey,
		timeoutMs: args.timeoutMs
	});
}
