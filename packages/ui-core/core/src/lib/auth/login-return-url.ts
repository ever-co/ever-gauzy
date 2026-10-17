/** The sign-in page every "your session ended" redirect leads to. */
export const LOGIN_URL = '/auth/login';

/** How deep a nested `returnUrl` chain is followed before it is given up on. */
const MAX_DEPTH = 10;

/**
 * Whether a router URL is one of the authentication pages (`/auth`, `/auth/login`, `/auth/register`, …).
 *
 * @param url A router URL, with or without a query string or fragment.
 * @returns True for an authentication page.
 */
export function isAuthUrl(url: string | null | undefined): boolean {
	const path = String(url ?? '').split(/[?#]/)[0];

	return path === '/auth' || path.startsWith('/auth/');
}

/**
 * The page a sign-in should return to after a session ended at `url` — never an authentication page itself (Q8d).
 *
 * Every redirect to the sign-in page carried `returnUrl: <the current URL>`. When the current URL was already the
 * sign-in page — the next request of a stale session failing while the first redirect was still on screen — the
 * redirect wrapped it: `/auth/login?returnUrl=/auth/login?returnUrl=/pages/dashboard`, one level deeper per failing
 * request. An authentication URL is therefore unwrapped to the `returnUrl` it carries, however deep, and an
 * authentication page with none answers `undefined` (no `returnUrl` at all).
 *
 * Only an in-app path is returned: a value that is not a path of this application (`https://…`, `//host`, `javascript:`)
 * is dropped, so a crafted link cannot turn the sign-in page into a redirect elsewhere.
 *
 * @param url The URL the session ended at: the router's current URL, or the URL a guard refused.
 * @returns The URL to come back to, or `undefined` when there is none worth returning to.
 */
export function loginReturnUrl(url: string | null | undefined): string | undefined {
	let current = String(url ?? '').trim();

	for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
		if (!isInAppPath(current) || current === '/') {
			return undefined;
		}

		if (!isAuthUrl(current)) {
			return current;
		}

		current = returnUrlOf(current) ?? '';
	}

	return undefined;
}

/**
 * The `returnUrl` query parameter of a URL, decoded.
 *
 * @param url A router URL.
 * @returns The parameter, or `null` when the URL carries none.
 */
function returnUrlOf(url: string): string | null {
	const query = url.indexOf('?');

	if (query < 0) {
		return null;
	}

	return new URLSearchParams(url.slice(query + 1).split('#')[0]).get('returnUrl');
}

/**
 * @param url A candidate return URL.
 * @returns True when it is an absolute path inside this application.
 */
function isInAppPath(url: string): boolean {
	return url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\');
}
