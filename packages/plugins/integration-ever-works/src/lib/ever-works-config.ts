import { getUnsafeOutboundUrlReason } from '@gauzy/utils';

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
}

/**
 * A base URL the integration may offer: HTTPS, public host, no credentials, query or fragment, and
 * without a trailing slash. Anything else is `null` (reported once through `warn`, without the value).
 */
export function normaliseEverWorksBaseUrl(raw: string | undefined, name: string, warn: (message: string) => void): string | null {
	const value = raw?.trim();
	if (!value) {
		return null;
	}
	const reason = getUnsafeOutboundUrlReason(value);
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
	return {
		defaultApiUrl: normaliseEverWorksBaseUrl(env['EVER_WORKS_API_URL'], 'EVER_WORKS_API_URL', warn),
		appUrl: normaliseEverWorksBaseUrl(env['EVER_WORKS_APP_URL'], 'EVER_WORKS_APP_URL', warn)
	};
}
