/**
 * Rate-limit (HTTP 429) detection for provider errors, and the envelope used to tell the chat client
 * about it.
 *
 * This exists because a 429 is the DEFINING failure of a free tier, and by default none of it
 * survives the server boundary: `toUIMessageStream` masks every error as the SDK's constant
 * `"An error occurred."` unless an `onError` mapper is supplied. Widening that mask generally would
 * leak provider internals to the browser, so only classified rate limits get a structured envelope
 * and everything else keeps the generic string.
 */

import { AI_CHAT_RATE_LIMIT_CODE, IAiChatRateLimitEnvelope } from '@gauzy/contracts';

/**
 * Re-exported for backend callers. The definitions live in @gauzy/contracts because the browser
 * needs the same runtime constant, and it must not import this plugin (that would pull NestJS into
 * the web bundle).
 */
export { AI_CHAT_RATE_LIMIT_CODE as RATE_LIMIT_CODE };
export type { IAiChatRateLimitEnvelope };

/** Unwrap the wrappers an error can arrive in before it is inspected. */
const unwrap = (error: unknown): unknown[] => {
	const seen = new Set<unknown>();
	const out: unknown[] = [];
	const visit = (e: unknown) => {
		if (!e || typeof e !== 'object' || seen.has(e)) return;
		seen.add(e);
		out.push(e);
		const anyErr = e as { cause?: unknown; lastError?: unknown; errors?: unknown[]; error?: unknown };
		visit(anyErr.cause);
		// `streamText` retries a 429 (it is flagged retryable), so what actually reaches onError is a
		// RetryError carrying the real one in `lastError` / `errors[]`.
		visit(anyErr.lastError);
		if (Array.isArray(anyErr.errors)) anyErr.errors.forEach(visit);
		visit(anyErr.error);
	};
	visit(error);
	return out;
};

const parseRetryAfter = (value: unknown): number | undefined => {
	if (typeof value !== 'string' && typeof value !== 'number') return undefined;
	const seconds = Number(value);
	return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : undefined;
};

/**
 * Is this error a provider rate limit?
 *
 * Handles the three shapes a 429 actually arrives in:
 *  - a real `APICallError` with `statusCode: 429` (checked structurally, NOT with `instanceof` —
 *    provider packages bundle their own copy of `@ai-sdk/provider`, so prototypes differ);
 *  - that same error wrapped in a `RetryError` after the SDK's automatic retries;
 *  - an HTTP 200 response carrying `{ error: { code: 429 } }` in-stream, which OpenRouter does and
 *    which has no status code or headers at all.
 */
export const isRateLimitError = (error: unknown): boolean => {
	for (const candidate of unwrap(error)) {
		const e = candidate as {
			statusCode?: unknown;
			status?: unknown;
			code?: unknown;
			responseHeaders?: Record<string, string>;
			data?: { error?: { code?: unknown } };
		};
		if (Number(e.statusCode) === 429 || Number(e.status) === 429 || Number(e.code) === 429) return true;
		if (Number(e.data?.error?.code) === 429) return true;
	}
	return false;
};

/** Seconds until reset, if any provider in the chain reported one. */
export const rateLimitRetryAfter = (error: unknown): number | undefined => {
	for (const candidate of unwrap(error)) {
		const headers = (candidate as { responseHeaders?: Record<string, string> }).responseHeaders;
		// Header names arrive lowercased.
		const value = headers?.['retry-after'] ?? headers?.['x-ratelimit-reset'];
		const seconds = parseRetryAfter(value);
		if (seconds !== undefined) return seconds;
	}
	return undefined;
};

/**
 * Build the JSON string handed to the stream's error channel.
 *
 * A string is the only thing that channel carries, so the structure rides inside it and the client
 * parses it back out.
 */
export const buildRateLimitEnvelope = (envelope: IAiChatRateLimitEnvelope): string => JSON.stringify(envelope);
