/**
 * The URL parameters that carry a secret: the single-use tokens of emailed links (account deletion,
 * password reset, invitations) and sign-in codes.
 */
const SECRET_PARAM = /([?&#])(token|code)=[^&#]*/gi;

/**
 * `url` with the value of every `token` / `code` parameter replaced by `[redacted]`, in the query and in
 * the fragment alike (the web app uses hash routing, so its "query" lives in the fragment).
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
	return url.replace(SECRET_PARAM, '$1$2=[redacted]') as unknown as T;
}
