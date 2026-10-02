import { environment } from '@gauzy/config';

/**
 * Which origins an emailed link may point at.
 *
 * Several endpoints accept a link from the caller and put it in an email that the API sends: the
 * sign-in code email (`appMagicSignUrl`), the verification email (`appEmailConfirmationUrl`), the
 * invitation emails (`callbackUrl`), the footer links of the branded emails (`appLink`,
 * `companyLink`), and the `Origin` / `originalUrl` that several emails use as the base of the links
 * they build. That is how Ever Teams sends its users to its own pages. Several of those links carry
 * a sign-in code or a verification / invitation token, so they may only lead to a front end of this
 * deployment.
 *
 * So a caller-supplied link is only honoured when its origin is one the deployment already serves:
 * `CLIENT_BASE_URL`, the configured `APP_EMAIL_CONFIRMATION_URL` / `APP_MAGIC_SIGN_URL` / `APP_LINK`,
 * plus anything listed in `EMAIL_LINK_ALLOWED_ORIGINS` (comma separated). Anything else falls back to
 * the configured default link, the one the deployment uses when the caller supplies none.
 *
 * `EMAIL_LINK_ALLOWED_ORIGINS=*` switches the origin check off (the previous behaviour), for a
 * self-hosted setup whose front end lives on an origin it cannot list. Even then, only absolute
 * http(s) links are used.
 */
export function isEmailLinkCheckDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
	return (env['EMAIL_LINK_ALLOWED_ORIGINS'] || '').trim() === '*';
}

/**
 * The set of origins a caller-supplied email link may use.
 *
 * @param env The process environment (injectable for tests).
 */
export function allowedEmailLinkOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
	const candidates: string[] = [
		environment.clientBaseUrl,
		environment.appIntegrationConfig?.appEmailConfirmationUrl,
		environment.appIntegrationConfig?.appMagicSignUrl,
		environment.appIntegrationConfig?.appLink,
		...(env['EMAIL_LINK_ALLOWED_ORIGINS'] || '').split(',')
	];

	const origins = new Set<string>();
	for (const candidate of candidates) {
		const origin = originOf(candidate);
		if (origin) {
			origins.add(origin);
		}
	}
	return origins;
}

/**
 * True when `url` is an absolute http(s) URL on one of `allowed`.
 *
 * @param url The link a caller asked for.
 * @param allowed The permitted origins.
 */
export function isAllowedEmailLink(url: unknown, allowed: Set<string>): boolean {
	const origin = originOf(url);
	return !!origin && allowed.has(origin);
}

/**
 * The integration fields that the email templates render as links (`href`).
 */
export const EMAIL_LINK_FIELDS = ['appLink', 'appEmailConfirmationUrl', 'appMagicSignUrl', 'companyLink'] as const;

export type EmailLinkField = (typeof EMAIL_LINK_FIELDS)[number];

/**
 * Called for every caller-supplied link that was not used. `origin` is the origin the link pointed
 * at, or null when it was not an absolute http(s) URL. The link itself is not passed on, so a log
 * line written from here cannot carry whatever the caller put in it.
 */
export type RejectedEmailLinkHandler = (field: string, origin: string | null) => void;

/**
 * A {@link RejectedEmailLinkHandler} that writes one warning per link that was not used.
 *
 * @param logger Where to write (a Nest `Logger`).
 * @param context What the link was for, e.g. `the sign-in code email`.
 */
export function warnRejectedEmailLink(
	logger: { warn(message: string): unknown },
	context: string
): RejectedEmailLinkHandler {
	return (field, origin) => {
		logger.warn(
			`Ignoring ${field} for ${context}: ${
				origin ? `its origin ${origin} is not` : 'it is not an absolute http(s) URL on'
			} one this deployment serves (add the origin to EMAIL_LINK_ALLOWED_ORIGINS if it should be).`
		);
	};
}

/**
 * The origin of `value` for a log line, or null when it is not an absolute http(s) URL.
 *
 * @param value A link a caller supplied.
 */
export function emailLinkOrigin(value: unknown): string | null {
	return originOf(value);
}

/**
 * `url` when it may be put in an email, otherwise null.
 *
 * The result is the URL as parsed and serialized again (user info removed), never the caller's raw
 * string: the email then carries exactly the URL whose origin was checked, so a mail client with a
 * different URL parser cannot read another host out of it (`\`, `@` and similar tricks).
 *
 * @param url The link a caller asked for.
 * @param env The process environment (injectable for tests).
 */
export function allowedEmailLink(url: unknown, env: NodeJS.ProcessEnv = process.env): string | null {
	const parsed = allowedHttpUrl(url, env);
	return parsed ? parsed.href : null;
}

/**
 * The base URL an email may build its links on: `url` reduced to `scheme://host[:port][/path]` (no
 * trailing slash, query or fragment) when its origin is allowed, otherwise `fallback`.
 *
 * Meant for the `originUrl` / `Origin` header values that emails use as `host` and as the base of
 * the links they build.
 *
 * @param url The base URL a caller supplied (usually the request's `Origin` header).
 * @param fallback The deployment's own base URL (`CLIENT_BASE_URL`).
 * @param env The process environment (injectable for tests).
 */
export function allowedEmailBaseUrl(url: unknown, fallback: string, env: NodeJS.ProcessEnv = process.env): string {
	const parsed = allowedHttpUrl(url, env);
	if (!parsed) {
		return fallback;
	}
	// A scan, not /\/+$/: the value comes from the caller, and that regex backtracks polynomially on
	// a long run of slashes.
	const path = parsed.pathname;
	let end = path.length;
	while (end > 0 && path.charCodeAt(end - 1) === 47 /* '/' */) {
		end--;
	}
	return parsed.origin + path.slice(0, end);
}

/**
 * A copy of `integration` in which every link field (see {@link EMAIL_LINK_FIELDS}) it carries is
 * either an allowed link or, when it is not, the deployment's configured value for that field.
 *
 * Fields that are absent stay absent, and the other fields (names, logo, signature) are left as
 * they are. Works on the caller's overrides before they are merged over
 * `environment.appIntegrationConfig` and on an already merged object alike.
 *
 * @param integration The caller's integration overrides (or a merged integration config).
 * @param onRejected Told about each link that was replaced (for a log line).
 * @param env The process environment (injectable for tests).
 */
export function withAllowedEmailLinks<T>(
	integration: T,
	onRejected?: RejectedEmailLinkHandler,
	env: NodeJS.ProcessEnv = process.env
): T {
	if (!integration || typeof integration !== 'object') {
		return integration;
	}

	const result: Record<string, unknown> = { ...(integration as Record<string, unknown>) };
	const defaults = (environment.appIntegrationConfig || {}) as Record<string, unknown>;

	for (const field of EMAIL_LINK_FIELDS) {
		if (!Object.prototype.hasOwnProperty.call(result, field)) {
			continue;
		}
		const value = result[field];
		if (value === defaults[field]) {
			// The deployment's own configured value (e.g. an already merged config): trusted as is.
			continue;
		}
		const allowed = allowedEmailLink(value, env);
		if (allowed) {
			result[field] = allowed;
			continue;
		}
		result[field] = defaults[field];
		if (value !== undefined && value !== null && value !== '') {
			onRejected?.(field, originOf(value));
		}
	}
	return result as T;
}

/** The parsed URL when `value` is an absolute http(s) URL on an allowed origin, otherwise null. */
function allowedHttpUrl(value: unknown, env: NodeJS.ProcessEnv): URL | null {
	const url = parseHttpUrl(value);
	if (!url) {
		return null;
	}
	if (!isEmailLinkCheckDisabled(env) && !allowedEmailLinkOrigins(env).has(url.origin.toLowerCase())) {
		return null;
	}
	url.username = '';
	url.password = '';
	return url;
}

/** `value` parsed, when it is an absolute http(s) URL with a host; otherwise null. */
function parseHttpUrl(value: unknown): URL | null {
	if (typeof value !== 'string' || !value.trim()) {
		return null;
	}
	try {
		const url = new URL(value.trim());
		if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname) {
			return null;
		}
		return url;
	} catch {
		return null;
	}
}

/** The `scheme://host[:port]` of an absolute http(s) URL, or null. */
function originOf(value: unknown): string | null {
	const url = parseHttpUrl(value);
	return url ? url.origin.toLowerCase() : null;
}
