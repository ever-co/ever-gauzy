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

/** Query-string keys whose values carry a credential or a one-time code: never copied into an event. */
export const REDACTED_QUERY_KEYS: ReadonlySet<string> = new Set([
	'token',
	'access_token',
	'accesstoken',
	'refresh_token',
	'refreshtoken',
	'id_token',
	'code',
	'password',
	'secret',
	'api_key',
	'apikey',
	'key',
	'signature',
	'state',
	'jwt',
	'handoff',
	'ticket'
]);

function isRedactedSegment(key: string): boolean {
	return REDACTED_QUERY_KEYS.has(key) || key.endsWith('token') || key.endsWith('secret') || key.endsWith('password');
}

/** `token`, `where[token]`, `filters[0][refresh_token]`: every bracketed segment of the name is checked. */
function isRedactedKey(name: string): boolean {
	return name
		.toLowerCase()
		.split(/[\[\]]+/)
		.filter(Boolean)
		.some(isRedactedSegment);
}

/** The parsed query with every credential-bearing value (at any depth) replaced by `[Filtered]`. */
export function redactQuery(query: unknown): unknown {
	if (Array.isArray(query)) {
		return query.map(redactQuery);
	}
	if (!query || typeof query !== 'object') {
		return query;
	}
	const redacted: Record<string, unknown> = {};
	for (const [name, value] of Object.entries(query as Record<string, unknown>)) {
		redacted[name] = isRedactedKey(name) ? '[Filtered]' : redactQuery(value);
	}
	return redacted;
}

/** The request URL with every credential-bearing query value replaced by `[Filtered]`; the path is kept. */
export function redactUrl(url: string): string {
	if (typeof url !== 'string') {
		return url;
	}
	const at = url.indexOf('?');
	if (at === -1) {
		return url;
	}
	const params = new URLSearchParams(url.slice(at + 1));
	let changed = false;
	for (const name of [...new Set(params.keys())]) {
		if (isRedactedKey(name)) {
			params.set(name, '[Filtered]');
			changed = true;
		}
	}
	return changed ? `${url.slice(0, at)}?${params.toString()}` : url;
}

/**
 * What an error event says about the request: its method, and its URL, headers and query with every credential
 * replaced by `[Filtered]`. Never the body, which carries passwords, tokens and one-time codes as readily as anything
 * else (`dataCollection.httpBodies` in `SentryService` collects none either).
 *
 * The interceptors used to attach `httpRequestToRequestData(request)` (HTTP) and `{ headers, data: body }` (GraphQL)
 * as they were, so every reported error carried the caller's bearer token, cookies, `X-API-KEY` and request body to
 * Sentry, past the redaction the request middleware applies to the same request.
 *
 * @param request The request the error was raised for.
 */
export function redactedRequestOf(request: any): Record<string, unknown> {
	return {
		method: request?.method,
		url: redactUrl(request?.originalUrl ?? request?.url),
		headers: redactHeaders(request?.headers ?? {}),
		query: redactQuery(request?.query)
	};
}

/**
 * Who an event is about: the user's id, and nothing else of the row. `request.user` is the whole `User` entity, its
 * password hash, refresh token, e-mail token and pending sign-in code included, and it was handed to `setUser` as it
 * was (`dataCollection.userInfo` in `SentryService` is off).
 *
 * @param user The authenticated user, if any.
 */
export function sentryUserOf(user: { id?: unknown } | null | undefined): { id: string } | null {
	return user?.id ? { id: String(user.id) } : null;
}
