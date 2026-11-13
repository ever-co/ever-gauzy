/**
 * The URL parameters that carry a secret: the single-use tokens of emailed links (account deletion,
 * password reset, invitations) and sign-in codes.
 */
const SECRET_PARAM_NAMES: ReadonlySet<string> = new Set(['token', 'code']);

/**
 * One parameter of a query or a fragment: its separator, its name as written and its value, up to the next `&` or
 * `#`, as a query parser reads it. A name stops at `?` too, so a hash route's path
 * (`#/auth/delete-account/confirm?token=…`) is never read as a name.
 */
const PARAM = /([?&#])([^=&#?]*)=([^&#]*)/g;

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
	return redactParameters(url) as unknown as T;
}

/**
 * `text` with every secret parameter's whole value redacted, a `?` in it included. The value of any other
 * parameter is read again from its first `?` on, so a `?token=` written inside it (`?next=/a?token=…`) is
 * redacted as well.
 */
function redactParameters(text: string): string {
	return text.replace(PARAM, (match: string, separator: string, name: string, value: string) => {
		if (SECRET_PARAM_NAMES.has(parameterName(name))) {
			return `${separator}${name}=[redacted]`;
		}
		const nested = value.indexOf('?');
		return nested < 0
			? match
			: `${separator}${name}=${value.slice(0, nested)}${redactParameters(value.slice(nested))}`;
	});
}

/**
 * Whether `url` carries a `token` / `code` parameter: what {@link redactUrlSecrets} would redact.
 *
 * @param url Any value; only a string can carry one.
 */
export function hasUrlSecrets(url: unknown): boolean {
	return typeof url === 'string' && redactUrlSecrets(url) !== url;
}
