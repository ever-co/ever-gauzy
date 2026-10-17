/** Request headers that carry a credential: never copied into an event. */
export const REDACTED_HEADERS: ReadonlySet<string> = new Set([
	'authorization',
	'proxy-authorization',
	'cookie',
	'set-cookie',
	'x-api-key',
	'x-auth-token',
	'x-cart-token'
]);

/**
 * The request's headers with every credential-bearing one replaced by `[Filtered]`. The headers used to be attached
 * as they were, bearer token and cookies included, so every event carried the caller's credentials to Sentry.
 */
export function redactHeaders(headers: Record<string, unknown>): Record<string, unknown> {
	const redacted: Record<string, unknown> = {};
	for (const name of Object.keys(headers ?? {})) {
		redacted[name] = REDACTED_HEADERS.has(name.toLowerCase()) ? '[Filtered]' : headers[name];
	}
	return redacted;
}
