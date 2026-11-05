/**
 * The URL parameters that carry a secret: the single-use tokens of emailed links (account deletion,
 * password reset, invitations) and sign-in codes.
 */
const SECRET_PARAM_NAMES: ReadonlySet<string> = new Set(['token', 'code']);

/**
 * One parameter of a query or a fragment: its separator, its name as written and its value. A name and a value
 * stop at `?` too: a hash route's path (`#/auth/delete-account/confirm?token=…`) is never read as a name, and a
 * `?token=` inside another parameter's value (`?next=/a?token=…`) is still read as a parameter of its own.
 */
const PARAM = /([?&#])([^=&#?]*)=([^&#?]*)/g;

/**
 * A parameter's name as the router reads it: percent-decoded (`%74` is a `t`, so a `token` spelled with it is
 * still one), case aside. A name that does not decode is read as written.
 */
function parameterName(raw: string): string {
	try {
		return decodeURIComponent(raw).toLowerCase();
	} catch {
		return raw.toLowerCase();
	}
}

/**
 * `url` with the value of every `token` / `code` parameter replaced by `[redacted]`, in the query and in
 * the fragment alike (the web app uses hash routing, so its "query" lives in the fragment). A name is
 * compared percent-decoded, as the router reads it, and is kept as it was written.
 *
 * For telemetry (error reports, breadcrumbs, product analytics): those record `location.href`, and an
 * emailed link's token must never reach a third party.
 *
 * @param url Any string; anything else is returned as it is.
 */
export function redactUrlSecrets<T>(url: T): T {
	if (typeof url !== 'string') {
		return url;
	}
	return url.replace(PARAM, (match: string, separator: string, name: string) =>
		SECRET_PARAM_NAMES.has(parameterName(name)) ? `${separator}${name}=[redacted]` : match
	) as unknown as T;
}

/**
 * Whether `url` carries a `token` / `code` parameter: what {@link redactUrlSecrets} would redact.
 *
 * @param url Any value; only a string can carry one.
 */
export function hasUrlSecrets(url: unknown): boolean {
	return typeof url === 'string' && redactUrlSecrets(url) !== url;
}
