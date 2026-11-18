/** The access-token claim that binds an embed token to the origin it was exchanged for. */
export const EMBED_ORIGIN_CLAIM = 'embedOrigin';

/** How long the list of every organization's allowed origins is kept for CORS: a removal applies within a minute. */
export const EMBED_ORIGINS_CACHE_MS = 60_000;

/**
 * A scheme and an authority, with at most one trailing slash. Checked on the value as written, before `URL` reduces
 * it: `URL` turns `/timer/..` into `/` and an empty `?` or `#` into nothing, which would pass for an origin.
 */
const ORIGIN_SHAPE = /^[a-z][a-z\d+.-]*:\/\/[^/?#\\]+\/?$/i;

/**
 * An origin as the browser sends it in the `Origin` header: scheme, host and port, lower case, default port dropped
 * (`https://App.Example.com:443/` gives `https://app.example.com`). Only http and https, with no path, query,
 * fragment, credentials or wildcard (written as `*` or as `%2A`, which the host parser decodes).
 *
 * @returns The normalized origin, or null for a value that is not one.
 */
export function normalizeOrigin(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}
	const trimmed = value.trim();
	if (!trimmed || trimmed.includes('*') || !ORIGIN_SHAPE.test(trimmed)) {
		return null;
	}
	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		return null;
	}
	const web = url.protocol === 'https:' || url.protocol === 'http:';
	const bare = url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password;
	if (!web || !bare || url.host.includes('*')) {
		return null;
	}
	return url.origin;
}
