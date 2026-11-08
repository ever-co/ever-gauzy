import { TRELLO_API_URL, TRELLO_IMPORT_INTERVAL_MINUTES_DEFAULT, TRELLO_DEFAULT_APP_NAME, TRELLO_ROUTE_PREFIX } from './trello.constants';

/** What the operator configured for the Trello integration. */
export interface TrelloConfig {
	/** The application's API key (`TRELLO_API_KEY`); `null` when unset. */
	apiKey: string | null;
	/**
	 * The application's secret (`TRELLO_API_SECRET`, shown with the key in Trello's Power-Up admin): Trello signs
	 * every webhook delivery with it. `null` when unset — then no webhook is registered (imports still work).
	 */
	apiSecret: string | null;
	/** The name Trello shows on its authorize page (`TRELLO_APP_NAME`). */
	appName: string;
	/**
	 * The web page Trello sends the person back to with the token (`TRELLO_RETURN_URL`, else `CLIENT_BASE_URL` +
	 * `/#/pages/integrations/trello`): that page hands the token to the API. `null` when neither is set.
	 */
	returnUrl: string | null;
	/**
	 * The public address Trello delivers webhooks to (`TRELLO_WEBHOOK_BASE_URL`, else `API_BASE_URL`), followed by
	 * `/api/integration/trello/webhook/:mappingId`. `null` = no webhooks are registered.
	 */
	webhookBaseUrl: string | null;
	/**
	 * How many minutes apart the worker imports the changes of each inbound mapping (`TRELLO_IMPORT_INTERVAL_MINUTES`,
	 * {@link TRELLO_IMPORT_INTERVAL_MINUTES_DEFAULT} by default); `0` switches the scheduled import off. A mapping with a live webhook
	 * (`webhookId`) is swept every fourth interval instead.
	 */
	importIntervalMinutes: number;
	/** Trello's REST endpoint (`TRELLO_API_URL`, for a test double); the public one by default. */
	apiUrl: string;
}

/** A URL the integration may use: absolute, HTTP(S), without credentials; `null` otherwise (reported once). */
export function normaliseTrelloUrl(raw: string | undefined, name: string, warn: (message: string) => void): string | null {
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
export function readTrelloConfig(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): TrelloConfig {
	const apiBase = normaliseTrelloUrl(env['API_BASE_URL'], 'API_BASE_URL', () => undefined);
	const clientBase = normaliseTrelloUrl(env['CLIENT_BASE_URL'], 'CLIENT_BASE_URL', () => undefined);
	const returnUrl =
		normaliseTrelloUrl(env['TRELLO_RETURN_URL'], 'TRELLO_RETURN_URL', warn) ?? (clientBase ? `${clientBase}/#/pages/integrations/trello` : null);
	// Webhooks need a public HTTPS address Trello can reach; a plain HTTP one is only for a local tunnel.
	const webhookBaseUrl = normaliseTrelloUrl(env['TRELLO_WEBHOOK_BASE_URL'], 'TRELLO_WEBHOOK_BASE_URL', warn) ?? apiBase;
	return {
		apiKey: env['TRELLO_API_KEY']?.trim() || null,
		apiSecret: env['TRELLO_API_SECRET']?.trim() || null,
		appName: env['TRELLO_APP_NAME']?.trim() || TRELLO_DEFAULT_APP_NAME,
		returnUrl,
		webhookBaseUrl,
		apiUrl: normaliseTrelloUrl(env['TRELLO_API_URL'], 'TRELLO_API_URL', warn) ?? TRELLO_API_URL,
		importIntervalMinutes: trelloImportIntervalOf(env['TRELLO_IMPORT_INTERVAL_MINUTES'], warn)
	};
}

/** A whole number of minutes (`0` = off); unset is the default, anything else is reported once and the default is used. */
export function trelloImportIntervalOf(raw: string | undefined, warn: (message: string) => void): number {
	const value = raw?.trim();
	if (!value) return TRELLO_IMPORT_INTERVAL_MINUTES_DEFAULT;
	if (!/^\d+$/.test(value)) {
		warn(`TRELLO_IMPORT_INTERVAL_MINUTES is not a whole number of minutes; the default (${TRELLO_IMPORT_INTERVAL_MINUTES_DEFAULT}) is used.`);
		return TRELLO_IMPORT_INTERVAL_MINUTES_DEFAULT;
	}
	return Number(value);
}

/** Whether a person can connect: the application's key and the page Trello returns to are known. */
export function isTrelloConfigured(config: TrelloConfig): boolean {
	return !!config.apiKey && !!config.returnUrl;
}

/** Whether webhooks can be registered and verified: a public address and the secret Trello signs with. */
export function trelloWebhooksEnabled(config: TrelloConfig): boolean {
	return !!config.webhookBaseUrl && !!config.apiSecret;
}

/** The address Trello delivers a mapping's events to, or null when webhooks are off. */
export function trelloWebhookTargetOf(config: TrelloConfig, mappingId: string): string | null {
	return trelloWebhooksEnabled(config) ? `${config.webhookBaseUrl}/api${TRELLO_ROUTE_PREFIX}/webhook/${encodeURIComponent(mappingId)}` : null;
}
