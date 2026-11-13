import { JIRA_API_GATEWAY_URL, JIRA_IMPORT_INTERVAL_MINUTES_DEFAULT, JIRA_OAUTH_AUTHORIZE_URL, JIRA_OAUTH_TOKEN_URL, JIRA_ROUTE_PREFIX } from './jira.constants';

/** What the operator configured for the Jira Cloud integration. */
export interface JiraCloudConfig {
	/** The OAuth 2.0 (3LO) app's client id (`JIRA_CLIENT_ID`); `null` when unset. */
	clientId: string | null;
	/**
	 * The OAuth app's client secret (`JIRA_CLIENT_SECRET`); `null` when unset. It is also the key Jira signs the
	 * dynamic webhooks of the app with (a bearer token in `Authorization`).
	 */
	clientSecret: string | null;
	/**
	 * Where Atlassian sends the person back after they authorize (`JIRA_REDIRECT_URL`, else `API_BASE_URL` +
	 * `/api/integration/jira/callback`); must equal the callback URL registered on the app. `null` when neither is set.
	 */
	redirectUrl: string | null;
	/**
	 * The web page the callback sends the person to once connected (`JIRA_POST_INSTALL_URL`, else `CLIENT_BASE_URL`
	 * + `/#/pages/integrations/jira`). `null` when neither is set.
	 */
	postInstallUrl: string | null;
	/**
	 * Where Jira delivers the dynamic webhooks (`JIRA_WEBHOOK_URL`, else `API_BASE_URL` + `/api/integration/jira/webhook`);
	 * the connection's id is appended. Jira delivers to HTTPS only: any other address leaves webhooks off (the
	 * scheduled import still follows Jira). `null` when neither is set.
	 */
	webhookBaseUrl: string | null;
	/**
	 * How many minutes apart the worker imports the changes of each inbound mapping (`JIRA_IMPORT_INTERVAL_MINUTES`,
	 * {@link JIRA_IMPORT_INTERVAL_MINUTES_DEFAULT} by default); `0` switches the scheduled import off. When webhooks
	 * are on every mapping is swept every fourth interval instead (a reconcile of missed deliveries).
	 */
	importIntervalMinutes: number;
	/** The Atlassian API gateway (`JIRA_API_URL`, for a test double); the public one by default. */
	apiUrl: string;
	/** Atlassian's authorization and token endpoints (`JIRA_AUTHORIZE_URL`, `JIRA_TOKEN_URL`, for a test double). */
	authorizeUrl: string;
	tokenUrl: string;
}

/** A URL the integration may use: absolute, HTTP(S), without credentials; `null` otherwise (reported once). */
export function normaliseJiraUrl(raw: string | undefined, name: string, warn: (message: string) => void): string | null {
	const value = raw?.trim();
	if (!value) {
		return null;
	}
	let url: URL | null;
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
export function readJiraConfig(env: Record<string, string | undefined> = process.env, warn: (message: string) => void = () => undefined): JiraCloudConfig {
	const apiBase = normaliseJiraUrl(env['API_BASE_URL'], 'API_BASE_URL', () => undefined);
	const clientBase = normaliseJiraUrl(env['CLIENT_BASE_URL'], 'CLIENT_BASE_URL', () => undefined);
	const redirectUrl =
		normaliseJiraUrl(env['JIRA_REDIRECT_URL'], 'JIRA_REDIRECT_URL', warn) ?? (apiBase ? `${apiBase}/api${JIRA_ROUTE_PREFIX}/callback` : null);
	const postInstallUrl =
		normaliseJiraUrl(env['JIRA_POST_INSTALL_URL'], 'JIRA_POST_INSTALL_URL', warn) ?? (clientBase ? `${clientBase}/#/pages/integrations/jira` : null);
	const webhookBaseUrl =
		normaliseJiraUrl(env['JIRA_WEBHOOK_URL'], 'JIRA_WEBHOOK_URL', warn) ?? (apiBase ? `${apiBase}/api${JIRA_ROUTE_PREFIX}/webhook` : null);
	return {
		clientId: env['JIRA_CLIENT_ID']?.trim() || null,
		clientSecret: env['JIRA_CLIENT_SECRET']?.trim() || null,
		redirectUrl,
		postInstallUrl,
		webhookBaseUrl,
		apiUrl: normaliseJiraUrl(env['JIRA_API_URL'], 'JIRA_API_URL', warn) ?? JIRA_API_GATEWAY_URL,
		authorizeUrl: normaliseJiraUrl(env['JIRA_AUTHORIZE_URL'], 'JIRA_AUTHORIZE_URL', warn) ?? JIRA_OAUTH_AUTHORIZE_URL,
		tokenUrl: normaliseJiraUrl(env['JIRA_TOKEN_URL'], 'JIRA_TOKEN_URL', warn) ?? JIRA_OAUTH_TOKEN_URL,
		importIntervalMinutes: jiraImportIntervalOf(env['JIRA_IMPORT_INTERVAL_MINUTES'], warn)
	};
}

/** A whole number of minutes (`0` = off); unset is the default, anything else is reported once and the default is used. */
export function jiraImportIntervalOf(raw: string | undefined, warn: (message: string) => void): number {
	const value = raw?.trim();
	if (!value) return JIRA_IMPORT_INTERVAL_MINUTES_DEFAULT;
	if (!/^\d+$/.test(value)) {
		warn(`JIRA_IMPORT_INTERVAL_MINUTES is not a whole number of minutes; the default (${JIRA_IMPORT_INTERVAL_MINUTES_DEFAULT}) is used.`);
		return JIRA_IMPORT_INTERVAL_MINUTES_DEFAULT;
	}
	return Number(value);
}

/** Whether a person can connect: the OAuth app and its callback are known. */
export function isJiraConfigured(config: JiraCloudConfig): boolean {
	return !!config.clientId && !!config.clientSecret && !!config.redirectUrl;
}

/**
 * Whether the connections take dynamic webhooks: the app is configured (its secret verifies the deliveries) and the
 * delivery address is HTTPS (Jira delivers nowhere else).
 */
export function jiraWebhooksEnabled(config: JiraCloudConfig): boolean {
	return isJiraConfigured(config) && !!config.webhookBaseUrl && config.webhookBaseUrl.startsWith('https://');
}

/**
 * The address Jira delivers a connection's webhooks to, or null when webhooks are off. The connection's id extends the
 * base address's path (a query or a fragment of the base stays where it is, after it).
 */
export function jiraWebhookTargetOf(config: JiraCloudConfig, integrationId: string): string | null {
	if (!jiraWebhooksEnabled(config)) return null;
	const target = new URL(config.webhookBaseUrl as string);
	target.pathname = `${target.pathname.replace(/\/+$/, '')}/${encodeURIComponent(integrationId)}`;
	return target.toString();
}
