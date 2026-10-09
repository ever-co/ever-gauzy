/**
 * Typed error classification for the `docs-processing` pipeline.
 *
 * Handlers throw `DocsTransientError` (retry through the BullMQ backoff policy) or
 * `DocsPermanentError` (mark the terminal state and complete — no useless retries).
 * `isTransientError` walks a cause chain for errors thrown by third-party libraries.
 */

/**
 * A transient pipeline failure: network/socket/timeout errors, HTTP 408/429/5xx from
 * providers, and storage-read hiccups. Rethrown so BullMQ retries with backoff.
 */
export class DocsTransientError extends Error {
	constructor(message: string, public readonly cause?: unknown) {
		super(message);
		this.name = 'DocsTransientError';
	}
}

/**
 * A permanent pipeline failure: corrupt/password-protected files, unsupported formats,
 * validation failures. The job marks the terminal state and is never retried.
 * Only `DocsPermanentError` messages are user-facing (`statusMessage`).
 */
export class DocsPermanentError extends Error {
	constructor(message: string, public readonly cause?: unknown) {
		super(message);
		this.name = 'DocsPermanentError';
	}
}

/** Error-code / message fragments that identify a transient (retryable) failure. */
const TRANSIENT_CODES = new Set([
	'ECONNRESET',
	'ECONNREFUSED',
	'ETIMEDOUT',
	'EAI_AGAIN',
	'ENOTFOUND',
	'EPIPE',
	'ECONNABORTED'
]);

/**
 * Classifies an arbitrary error as transient (retry) or permanent (terminal), walking
 * the `cause` chain. `DocsTransientError`/`DocsPermanentError` are authoritative;
 * network error codes and provider 408/429/5xx statuses are transient; everything else
 * defaults to permanent (a deterministic extraction failure will not fix itself).
 *
 * @param error The thrown error.
 * @returns True when the error should be retried.
 */
export function isTransientError(error: unknown): boolean {
	let current: any = error;
	let depth = 0;

	while (current && depth < 8) {
		if (current instanceof DocsTransientError) {
			return true;
		}
		if (current instanceof DocsPermanentError) {
			return false;
		}
		if (typeof current.code === 'string' && TRANSIENT_CODES.has(current.code)) {
			return true;
		}
		const status = Number(current.status ?? current.statusCode ?? current.response?.status);
		if (Number.isFinite(status) && (status === 408 || status === 429 || status >= 500)) {
			return true;
		}
		current = current.cause;
		depth++;
	}

	return false;
}
