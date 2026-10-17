import { InboxSecretBox } from './secrets/inbox-secret-box';

/** The provider webhook route, under `/api` (plan 04 §3). */
export const INBOX_INBOUND_ROUTE = '/inbox/inbound';

/** The id of the built-in generic signed-webhook provider, and the account id of the platform route. */
export const GENERIC_PROVIDER_ID = 'generic';
export const PLATFORM_ACCOUNT_ID = 'platform';

/** DI token of the `InboxSecretBox` (a class without Nest decorators, so it can be built in tests). */
export const INBOX_SECRET_BOX = 'INBOX_SECRET_BOX';

/** The process's secret box. */
export function createInboxSecretBox(): InboxSecretBox {
	return new InboxSecretBox(process.env);
}

/** The API's public base URL (`API_BASE_URL`, no trailing slash): webhook URLs are built on it. */
export function apiBaseUrl(env: Record<string, string | undefined> = process.env): string {
	const raw = (env['API_BASE_URL'] || 'http://localhost:3000').trim();
	return raw.replace(/\/+$/, '');
}

/** The URL a provider posts an account's mail to. */
export function inboundWebhookUrl(providerId: string, accountId: string, base = apiBaseUrl()): string {
	return `${base}/api${INBOX_INBOUND_ROUTE}/${encodeURIComponent(providerId)}/${encodeURIComponent(accountId)}`;
}

/** The longest `lastError` kept on an account. */
export const PROVIDER_ACCOUNT_ERROR_MAX = 500;
