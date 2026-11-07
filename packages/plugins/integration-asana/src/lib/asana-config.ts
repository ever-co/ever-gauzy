import { ASANA_API_URL, ASANA_IMPORT_INTERVAL_MINUTES_DEFAULT, ASANA_ROUTE_PREFIX } from './asana.constants';

/** What the operator configured for the Asana integration. */
export interface AsanaConfig {
	/** The OAuth application's client id (`ASANA_CLIENT_ID`); `null` when unset. */
	clientId: string | null;
	/** The OAuth application's client secret (`ASANA_CLIENT_SECRET`); `null` when unset. */
	clientSecret: string | null;
	/**
	 * Where Asana sends the person back after they authorize (`ASANA_REDIRECT_URL`, else `API_BASE_URL` +
	 * `/api/integration/asana/callback`); must equal a redirect URL registered on the application. `null` when
	 * neither is set.
	 */
	redirectUrl: string | null;
	/**
	 * The web page the callback sends the person to once connected (`ASANA_POST_INSTALL_URL`, else
	 * `CLIENT_BASE_URL` + `/#/pages/integrations/asana`). `null` when neither is set.
	 */
	postInstallUrl: string | null;
	/**
	 * The public address Asana delivers webhooks to (`ASANA_WEBHOOK_BASE_URL`, else `API_BASE_URL`), followed by
	 * `/api/integration/asana/webhook/:mappingId`. `null` = no webhooks are registered (imports still work).
	 */
	webhookBaseUrl: string | null;
	/**
	 * How many minutes apart the worker imports the changes of each inbound mapping (`ASANA_IMPORT_INTERVAL_MINUTES`,
	 * {@link ASANA_IMPORT_INTERVAL_MINUTES_DEFAULT} by default); `0` switches the scheduled import off. A mapping with a live webhook
	 * (`webhookGid`) is swept every fourth interval instead.
	 */
	importIntervalMinutes: number;
	/** Asana's REST endpoint (`ASANA_API_URL`, for a test double); the public one by default. */
	apiUrl: string;
}

/** A URL the integration may use: absolute, HTTP(S), without credentials; `null` otherwise (reported once). */
export function normaliseAsanaUrl(raw: string | undefined, name: string, warn: (message: string) => void): string | null {
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
export function readAsanaConfig(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): AsanaConfig {
	const apiBase = normaliseAsanaUrl(env['API_BASE_URL'], 'API_BASE_URL', () => undefined);
	const clientBase = normaliseAsanaUrl(env['CLIENT_BASE_URL'], 'CLIENT_BASE_URL', () => undefined);
	const redirectUrl =
		normaliseAsanaUrl(env['ASANA_REDIRECT_URL'], 'ASANA_REDIRECT_URL', warn) ??
		(apiBase ? `${apiBase}/api${ASANA_ROUTE_PREFIX}/callback` : null);
	const postInstallUrl =
		normaliseAsanaUrl(env['ASANA_POST_INSTALL_URL'], 'ASANA_POST_INSTALL_URL', warn) ??
		(clientBase ? `${clientBase}/#/pages/integrations/asana` : null);
	// Webhooks need a public HTTPS address Asana can reach; a plain HTTP one is only for a local tunnel.
	const webhookBaseUrl = normaliseAsanaUrl(env['ASANA_WEBHOOK_BASE_URL'], 'ASANA_WEBHOOK_BASE_URL', warn) ?? apiBase;
	return {
		clientId: env['ASANA_CLIENT_ID']?.trim() || null,
		clientSecret: env['ASANA_CLIENT_SECRET']?.trim() || null,
		redirectUrl,
		postInstallUrl,
		webhookBaseUrl,
		apiUrl: normaliseAsanaUrl(env['ASANA_API_URL'], 'ASANA_API_URL', warn) ?? ASANA_API_URL,
		importIntervalMinutes: asanaImportIntervalOf(env['ASANA_IMPORT_INTERVAL_MINUTES'], warn)
	};
}

/** A whole number of minutes (`0` = off); unset is the default, anything else is reported once and the default is used. */
export function asanaImportIntervalOf(raw: string | undefined, warn: (message: string) => void): number {
	const value = raw?.trim();
	if (!value) return ASANA_IMPORT_INTERVAL_MINUTES_DEFAULT;
	if (!/^\d+$/.test(value)) {
		warn(`ASANA_IMPORT_INTERVAL_MINUTES is not a whole number of minutes; the default (${ASANA_IMPORT_INTERVAL_MINUTES_DEFAULT}) is used.`);
		return ASANA_IMPORT_INTERVAL_MINUTES_DEFAULT;
	}
	return Number(value);
}

/** Whether a person can connect: the OAuth application and its callback are known. */
export function isAsanaConfigured(config: AsanaConfig): boolean {
	return !!config.clientId && !!config.clientSecret && !!config.redirectUrl;
}

/** The address Asana delivers a mapping's events to, or null when webhooks are off. */
export function asanaWebhookTargetOf(config: AsanaConfig, mappingId: string, handshakeToken?: string | null): string | null {
	if (!config.webhookBaseUrl) return null;
	const target = `${config.webhookBaseUrl}/api${ASANA_ROUTE_PREFIX}/webhook/${encodeURIComponent(mappingId)}`;
	// The registration's single-use token: the receiver accepts the handshake only with it (see the webhook controller).
	return handshakeToken ? `${target}?handshake=${encodeURIComponent(handshakeToken)}` : target;
}
