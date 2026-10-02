import { environment } from '@gauzy/config';

/**
 * Which origins an emailed verification link may point at.
 *
 * `POST /auth/email/verify/resend-link` (and the internal register path) accept an
 * `appEmailConfirmationUrl` from the caller, so that Ever Teams can send its users to its own
 * `/verify-email` page. The token in that link is the proof that someone reads the mailbox, and
 * that proof is what billing relies on before it attaches a paid Stripe customer to a tenant
 * (`TenantService.linkStripeCustomer`). If the caller could choose any host, then someone who had
 * registered with a paying buyer's address could ask for a verification mail whose link points at a
 * server they control: the buyer receives a genuine Gauzy email, clicks it, and hands over the token.
 *
 * So a caller-supplied link is only honoured when its origin is one the deployment already serves:
 * `CLIENT_BASE_URL`, the configured `APP_EMAIL_CONFIRMATION_URL` / `APP_MAGIC_SIGN_URL` / `APP_LINK`,
 * plus anything listed in `EMAIL_LINK_ALLOWED_ORIGINS` (comma separated). Anything else falls back to
 * the configured default link, which is what registration has always used.
 *
 * `EMAIL_LINK_ALLOWED_ORIGINS=*` switches the check off (the previous behaviour), for a self-hosted
 * setup whose front end lives on an origin it cannot list.
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

/** The `scheme://host[:port]` of an absolute http(s) URL, or null. */
function originOf(value: unknown): string | null {
	if (typeof value !== 'string' || !value.trim()) {
		return null;
	}
	try {
		const url = new URL(value.trim());
		if (url.protocol !== 'https:' && url.protocol !== 'http:') {
			return null;
		}
		return url.origin.toLowerCase();
	} catch {
		return null;
	}
}
