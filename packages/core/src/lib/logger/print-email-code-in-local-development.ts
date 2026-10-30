import { LoggerService } from '@nestjs/common';
import { environment, isDevelopment } from '@gauzy/config';
import { isPrivateOrLoopbackHost } from '@gauzy/utils';

/**
 * Whether `url` is served from this machine or a private network (`localhost`, a loopback or a private address).
 *
 * @param url - One of the instance's base URLs
 */
function isLocalUrl(url: string): boolean {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}
	const { hostname } = parsed;
	if (!hostname) {
		return false;
	}
	return isPrivateOrLoopbackHost(hostname);
}

/**
 * Prints a code or a link that an email carries (sign-in, verification, password reset, invitation, account
 * deletion) on the console of a local development instance, so a contributor can go on without a working mail
 * server.
 *
 * A local development instance is a development one (see `isDevelopment`) whose API and app are both served from
 * this machine or a private network. The public demo also runs as a development instance, behind public URLs, and
 * the codes of its visitors must stay out of its logs. Anywhere else nothing is printed and the line is never built.
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
	if (!isDevelopment()) {
		return;
	}
	if (!value) {
		return;
	}
	const apiIsLocal = isLocalUrl(environment.baseUrl);
	const appIsLocal = isLocalUrl(environment.clientBaseUrl);
	const isLocalInstance = apiIsLocal && appIsLocal;
	if (!isLocalInstance) {
		return;
	}
	logger.log(`[DEV] ${label} for ${recipient}: ${value}`);
}
