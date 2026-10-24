import { getUnsafeOutboundUrlReason } from '@gauzy/utils';
import { isEverWorksLoopbackUrl, readEverWorksAllowLoopback } from './client/ever-works-loopback';

/** What the operator configured for the Ever Works integration (all optional). */
export interface EverWorksConfig {
	/**
	 * The Ever Works API base URL offered as the default in the connect form (`EVER_WORKS_API_URL`),
	 * for example the Ever Works Cloud API documented in the plugin README. `null` when unset or
	 * unusable: the admin then types the URL of their Ever Works.
	 */
	defaultApiUrl: string | null;
	/**
	 * The Ever Works web app (`EVER_WORKS_APP_URL`), used only to link the admin to the page that
	 * creates an integration key. `null` when unset or unusable.
	 */
	appUrl: string | null;
	/**
	 * The public HTTPS address of this Gauzy API (`API_BASE_URL`), where Ever Works delivers webhooks.
	 * `null` when unset or not HTTPS: the change feed keeps syncing without webhooks.
	 */
	gauzyApiUrl: string | null;
	/**
	 * `EVER_WORKS_ALLOW_LOOPBACK=true` in a development or test process: an Ever Works API and an `API_BASE_URL` on
	 * a loopback address (`localhost`, `127.0.0.1`, `[::1]`, HTTP or HTTPS) are accepted, for a local run of the pair.
	 * Off by default and always off in production (see `client/ever-works-loopback.ts`).
	 */
	allowLoopback?: boolean;
}

/**
 * A base URL the integration may offer: HTTPS, public host, no credentials, query or fragment, and
 * without a trailing slash. Anything else is `null` (reported once through `warn`, without the value).
 */
export function normaliseEverWorksBaseUrl(
	raw: string | undefined,
	name: string,
	warn: (message: string) => void,
	options: { allowLoopback?: boolean } = {}
): string | null {
	const value = raw?.trim();
	if (!value) {
		return null;
	}
	const reason = options.allowLoopback && isEverWorksLoopbackUrl(value) ? null : getUnsafeOutboundUrlReason(value);
	let url: URL | null = null;
	try {
		url = new URL(value);
	} catch {
		url = null;
	}
	if (reason || !url || url.search || url.hash) {
		warn(`${name} is not a usable public HTTPS URL without a query or fragment; it is ignored.`);
		return null;
	}
	return url.toString().replace(/\/+$/, '');
}

/** Reads the integration's settings from the environment. Never throws. */
export function readEverWorksConfig(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): EverWorksConfig {
	const allowLoopback = readEverWorksAllowLoopback(env, warn);
	return {
		defaultApiUrl: normaliseEverWorksBaseUrl(env['EVER_WORKS_API_URL'], 'EVER_WORKS_API_URL', warn, { allowLoopback }),
		appUrl: normaliseEverWorksBaseUrl(env['EVER_WORKS_APP_URL'], 'EVER_WORKS_APP_URL', warn, { allowLoopback }),
		// Not a warning when unusable: a local or private API simply receives no webhooks (unless the loopback
		// switch is on, which admits a loopback address for a local run of the pair).
		gauzyApiUrl: normaliseEverWorksBaseUrl(env['API_BASE_URL'], 'API_BASE_URL', () => undefined, { allowLoopback }),
		allowLoopback
	};
}
