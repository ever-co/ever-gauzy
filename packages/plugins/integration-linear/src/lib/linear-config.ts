import { LINEAR_API_URL, LINEAR_IMPORT_INTERVAL_MINUTES_DEFAULT, LINEAR_ROUTE_PREFIX } from './linear.constants';

/** What the operator configured for the Linear integration. */
export interface LinearConfig {
	/** The OAuth application's client id (`LINEAR_CLIENT_ID`); `null` when unset. */
	clientId: string | null;
	/** The OAuth application's client secret (`LINEAR_CLIENT_SECRET`); `null` when unset. */
	clientSecret: string | null;
	/**
	 * Where Linear sends the person back after they authorize (`LINEAR_REDIRECT_URL`, else
	 * `API_BASE_URL` + `/api/integration/linear/callback`); must equal the callback URL registered on the
	 * OAuth application. `null` when neither is set.
	 */
	redirectUrl: string | null;
	/**
	 * The web page the callback sends the person to once connected (`LINEAR_POST_INSTALL_URL`, else
	 * `CLIENT_BASE_URL` + `/#/pages/integrations/linear`). `null` when neither is set.
	 */
	postInstallUrl: string | null;
	/** The signing secret of the application's webhooks (`LINEAR_WEBHOOK_SECRET`); `null` = webhooks refused. */
	webhookSecret: string | null;
	/**
	 * How many minutes apart the worker imports the changes of each inbound mapping (`LINEAR_IMPORT_INTERVAL_MINUTES`,
	 * {@link LINEAR_IMPORT_INTERVAL_MINUTES_DEFAULT} by default); `0` switches the scheduled import off. When the application has a
	 * webhook secret (`LINEAR_WEBHOOK_SECRET`) every mapping is swept every fourth interval instead.
	 */
	importIntervalMinutes: number;
	/** Linear's GraphQL endpoint (`LINEAR_API_URL`, for a test double); the public one by default. */
	apiUrl: string;
}

/** A URL the integration may use: absolute, HTTP(S), without credentials; `null` otherwise (reported once). */
export function normaliseLinearUrl(raw: string | undefined, name: string, warn: (message: string) => void): string | null {
	const value = raw?.trim();
	if (!value) {
		return null;
	}
	let url: URL | null = null;
	try {
		url = new URL(value);
	} catch {
		url = null;
	}
	if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) {
		warn(`${name} is not a usable HTTP(S) URL; it is ignored.`);
		return null;
	}
	return url.toString().replace(/\/+$/, '');
}

/** Reads the integration's settings from the environment. Never throws. */
export function readLinearConfig(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): LinearConfig {
	const apiBase = normaliseLinearUrl(env['API_BASE_URL'], 'API_BASE_URL', () => undefined);
	const clientBase = normaliseLinearUrl(env['CLIENT_BASE_URL'], 'CLIENT_BASE_URL', () => undefined);
	const redirectUrl =
		normaliseLinearUrl(env['LINEAR_REDIRECT_URL'], 'LINEAR_REDIRECT_URL', warn) ??
		(apiBase ? `${apiBase}/api${LINEAR_ROUTE_PREFIX}/callback` : null);
	const postInstallUrl =
		normaliseLinearUrl(env['LINEAR_POST_INSTALL_URL'], 'LINEAR_POST_INSTALL_URL', warn) ??
		(clientBase ? `${clientBase}/#/pages/integrations/linear` : null);
	return {
		clientId: env['LINEAR_CLIENT_ID']?.trim() || null,
		clientSecret: env['LINEAR_CLIENT_SECRET']?.trim() || null,
		redirectUrl,
		postInstallUrl,
		webhookSecret: env['LINEAR_WEBHOOK_SECRET']?.trim() || null,
		apiUrl: normaliseLinearUrl(env['LINEAR_API_URL'], 'LINEAR_API_URL', warn) ?? LINEAR_API_URL,
		importIntervalMinutes: linearImportIntervalOf(env['LINEAR_IMPORT_INTERVAL_MINUTES'], warn)
	};
}

/** A whole number of minutes (`0` = off); unset is the default, anything else is reported once and the default is used. */
export function linearImportIntervalOf(raw: string | undefined, warn: (message: string) => void): number {
	const value = raw?.trim();
	if (!value) return LINEAR_IMPORT_INTERVAL_MINUTES_DEFAULT;
	if (!/^\d+$/.test(value)) {
		warn(`LINEAR_IMPORT_INTERVAL_MINUTES is not a whole number of minutes; the default (${LINEAR_IMPORT_INTERVAL_MINUTES_DEFAULT}) is used.`);
		return LINEAR_IMPORT_INTERVAL_MINUTES_DEFAULT;
	}
	return Number(value);
}

/** Whether a person can connect: the OAuth application and its callback are known. */
export function isLinearConfigured(config: LinearConfig): boolean {
	return !!config.clientId && !!config.clientSecret && !!config.redirectUrl;
}
