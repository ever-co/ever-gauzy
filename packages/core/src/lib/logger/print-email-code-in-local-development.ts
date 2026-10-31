import { LoggerService } from '@nestjs/common';
import { environment, isDevelopment } from '@gauzy/config';

/** The value of PRINT_EMAIL_CODES with which any build, production included, may print (see `isOptedIn`). */
const PRINT_EMAIL_CODES_OPT_IN = 'true';

/** The four numbers of a dotted IPv4 address, as `URL` writes one, or null for any other host. */
function ipv4Octets(hostname: string): number[] | null {
	const isDottedQuad = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
	if (!isDottedQuad) {
		return null;
	}
	const parts = hostname.split('.');
	return parts.map(Number);
}

/** Whether `hostname` is this machine: `localhost`, a name ending in `.localhost`, 127.0.0.0/8 or ::1. */
function isLoopbackHost(hostname: string): boolean {
	if (hostname === 'localhost') {
		return true;
	}
	if (hostname.endsWith('.localhost')) {
		return true;
	}
	if (hostname === '::1') {
		return true;
	}
	const octets = ipv4Octets(hostname);
	if (!octets) {
		return false;
	}
	return octets[0] === 127;
}

/**
 * Whether `hostname` is this machine or a private network: a loopback host, 10.0.0.0/8, 172.16.0.0/12 or
 * 192.168.0.0/16. Kept apart from the SSRF deny-list on purpose, so that a range added there never widens where
 * codes are printed.
 */
function isLocalHost(hostname: string): boolean {
	if (isLoopbackHost(hostname)) {
		return true;
	}
	const octets = ipv4Octets(hostname);
	if (!octets) {
		return false;
	}
	const [first, second] = octets;
	const isIn10 = first === 10;
	const isIn172 = first === 172;
	const isIn172Private = second >= 16 && second <= 31;
	const isPrivate172 = isIn172 && isIn172Private;
	const isPrivate192 = first === 192 && second === 168;
	return isIn10 || isPrivate172 || isPrivate192;
}

/** The host of `url`, without the brackets `URL` keeps around an IPv6 address (`[::1]` gives `::1`), or null. */
function hostOf(url: string): string | null {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}
	const { hostname } = parsed;
	const host = hostname.replace(/^\[(.*)\]$/, '$1');
	if (!host) {
		return null;
	}
	return host;
}

/** Whether `url` has a host that `isAccepted` accepts. */
function isUrlOn(url: string, isAccepted: (hostname: string) => boolean): boolean {
	const host = hostOf(url);
	if (!host) {
		return false;
	}
	return isAccepted(host);
}

/** Whether API_BASE_URL and CLIENT_BASE_URL both have a host that `isAccepted` accepts. */
function areBaseUrlsOn(isAccepted: (hostname: string) => boolean): boolean {
	const apiIsAccepted = isUrlOn(environment.baseUrl, isAccepted);
	const appIsAccepted = isUrlOn(environment.clientBaseUrl, isAccepted);
	return apiIsAccepted && appIsAccepted;
}

/**
 * Whether this is a local development instance: a development build (see `isDevelopment`) whose API and app are
 * both served from this machine or a private network. The public demo also runs as a development instance, behind
 * public URLs, and the codes of its visitors must stay out of its logs.
 */
function isLocalDevelopmentInstance(): boolean {
	if (!isDevelopment()) {
		return false;
	}
	return areBaseUrlsOn(isLocalHost);
}

/**
 * Whether a production build run locally (a Docker image, say) opted in: PRINT_EMAIL_CODES is exactly 'true',
 * NODE_ENV is development, and its API and app are both served from this machine.
 */
function isOptedIn(): boolean {
	const optedIn = process.env.PRINT_EMAIL_CODES === PRINT_EMAIL_CODES_OPT_IN;
	if (!optedIn) {
		return false;
	}
	const runsAsDevelopment = process.env.NODE_ENV === 'development';
	if (!runsAsDevelopment) {
		return false;
	}
	return areBaseUrlsOn(isLoopbackHost);
}

/** Whether this instance may print the codes and links of its emails. */
function mayPrintEmailCodes(): boolean {
	if (isLocalDevelopmentInstance()) {
		return true;
	}
	return isOptedIn();
}

/**
 * Prints a code or a link that an email carries (sign-in, verification, password reset, invitation, account
 * deletion) on the console of a local development instance, or of a production build that opted in with
 * PRINT_EMAIL_CODES=true, so a contributor can go on without a working mail server. Anywhere else nothing is
 * printed and the line is never built.
 *
 * @param logger - The logger of the calling service
 * @param label - What the value is, for example "Sign-in code"
 * @param recipient - The address the email goes to
 * @param value - The code or the link; nothing is printed without one
 */
export function printEmailCodeInLocalDevelopment(
	logger: LoggerService,
	label: string,
	recipient: string,
	value: string | undefined
): void {
	if (!mayPrintEmailCodes()) {
		return;
	}
	if (!value) {
		return;
	}
	logger.log(`[DEV] ${label} for ${recipient}: ${value}`);
}
