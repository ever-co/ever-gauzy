/**
 * How a speech-to-text attempt failed, classified WITHOUT regex-sniffing the message.
 *
 * `AiChatService.transcribe()` maps these onto the wire-level `AiSpeechErrorCode`s (a rejected key
 * points the user at Settings → AI Providers, everything else does not), and it must not have to
 * guess that from prose that every provider phrases differently.
 *
 * - `key-rejected`   — HTTP 401/403: the credential is wrong, expired or lacks the scope.
 * - `rate-limited`   — HTTP 429.
 * - `audio-rejected` — HTTP 400/415/422: the recording itself was refused (format, empty, too long).
 * - `http`           — any other non-2xx.
 * - `network`        — the request never got an HTTP answer (DNS, refused, timeout).
 * - `response`       — 2xx but the body was not what the API documents.
 */
export type SpeechProviderErrorKind = 'key-rejected' | 'rate-limited' | 'audio-rejected' | 'http' | 'network' | 'response';

/**
 * Error thrown by speech-to-text provider hooks.
 *
 * The `message` is user-facing (the chat panel shows it verbatim) and MUST already be scrubbed of
 * secrets — see `redactSecret` in `openai-compatible-transcribe.ts`.
 */
export class SpeechProviderError extends Error {
	override readonly name = 'SpeechProviderError';

	constructor(
		message: string,
		/** Machine-readable failure class. */
		readonly kind: SpeechProviderErrorKind,
		/** Provider that failed (registry id), for logs and the `attemptedProviders` list. */
		readonly providerId?: string,
		/** Upstream HTTP status, when there was one. */
		readonly status?: number
	) {
		super(message);
		// Restore the prototype chain: TS targets below ES2015-class semantics for Error subclasses
		// otherwise make `instanceof SpeechProviderError` false on the thrown value.
		Object.setPrototypeOf(this, new.target.prototype);
	}
}

/** `true` when `error` is a {@link SpeechProviderError} (duck-typed, so copies across bundles count). */
export function isSpeechProviderError(error: unknown): error is SpeechProviderError {
	return (
		error instanceof SpeechProviderError ||
		(typeof error === 'object' &&
			error !== null &&
			(error as { name?: unknown }).name === 'SpeechProviderError' &&
			typeof (error as { kind?: unknown }).kind === 'string')
	);
}
