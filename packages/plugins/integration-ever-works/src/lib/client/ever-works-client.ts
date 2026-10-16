import { randomUUID } from 'node:crypto';
import { getUnsafeOutboundUrlReason } from '@gauzy/utils';
import { EVER_WORKS_CONTRACT_VERSION, EVER_WORKS_PLUGIN_VERSION } from '../ever-works.constants';
import {
	EverWorksCreateWebhook,
	EverWorksErrorBody,
	EverWorksEventsPage,
	EverWorksWebhookSubscription,
	EverWorksWhoami
} from './ever-works-client.types';
import type { EverWorksHttpRequest, EverWorksHttpResponse, EverWorksTransport } from './ever-works-transport';

/** The contract namespace appended to the API base URL the admin enters (`https://…/api`). */
export const EVER_WORKS_CONTRACT_PATH = `/integrations/v${EVER_WORKS_CONTRACT_VERSION}`;

/** `User-Agent` of every call (plan 02 §4). */
export const EVER_WORKS_USER_AGENT = `ever-gauzy-ever-works/${EVER_WORKS_PLUGIN_VERSION}`;

/** A response from Ever Works that is not a success. Carries no key, no header and no request body. */
export class EverWorksApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly details: Record<string, unknown> | undefined = undefined,
		readonly retryAfterSeconds: number | null = null
	) {
		super(message);
		this.name = 'EverWorksApiError';
	}

	/** 429 and every 5xx: worth trying again later. */
	get retryable(): boolean {
		return this.status === 429 || this.status >= 500;
	}
}

/** No response from Ever Works (DNS, connection, TLS, timeout, size cap, SSRF block). */
export class EverWorksNetworkError extends Error {
	constructor(readonly reason: string) {
		super(`Ever Works could not be reached (${reason}).`);
		this.name = 'EverWorksNetworkError';
	}
}

/** Retry policy for 429, 5xx and network failures. */
export interface EverWorksRetryPolicy {
	/** Attempts in total, the first one included (1 = no retry). */
	maxAttempts: number;
	baseDelayMs: number;
	maxDelayMs: number;
	/** The longest `Retry-After` honoured before giving up and reporting the 429. */
	maxRetryAfterMs: number;
}

export const DEFAULT_RETRY_POLICY: EverWorksRetryPolicy = {
	maxAttempts: 3,
	baseDelayMs: 500,
	maxDelayMs: 8_000,
	maxRetryAfterMs: 60_000
};

export interface EverWorksClientOptions {
	/** The API base URL (`https://api.example/api`); `/integrations/v1` is appended. */
	apiBaseUrl: string;
	/** The integration key (`ew_int_…`). Kept in memory for the client's lifetime only. */
	apiKey: string;
	transport: EverWorksTransport;
	/** The Gauzy connection id; `X-Sync-Origin: gauzy:<id>` on every write. */
	connectionId?: string | null;
	/** `X-Scope-Slug`: the pinned Ever Works organization the org-scoped calls are for. */
	scopeSlug?: string | null;
	retry?: Partial<EverWorksRetryPolicy>;
	timeoutMs?: number;
	/** Test seams. */
	sleep?: (ms: number) => Promise<void>;
	random?: () => number;
	/** Test seam: allow `http://` and private hosts (the mock Ever Works server). Never set in production. */
	allowInsecureBaseUrlForTests?: boolean;
}

export interface EverWorksRequestOptions {
	query?: Record<string, string | number | boolean | undefined | null>;
	body?: unknown;
	/** Required on every POST that creates something (B.1); a random one is used when absent. */
	idempotencyKey?: string;
	/** `If-Match: "<version>"` on PATCH/PUT/DELETE. */
	ifMatchVersion?: number;
	/** `X-Act-As-User` on writes. */
	actAsUserId?: string | null;
	/** Overrides the client's scope for this call (`null` removes it, e.g. for `/whoami`). */
	scopeSlug?: string | null;
}

/**
 * Normalises the API base URL an admin entered: HTTPS, public host, no credentials, query or fragment,
 * no trailing slash, and without the contract path when it was pasted with it. Throws a message that is
 * safe to show (it never repeats the URL's credentials).
 */
export function normaliseApiBaseUrl(raw: string, options: { allowInsecure?: boolean } = {}): string {
	const value = (raw ?? '').trim();
	const reason = options.allowInsecure ? null : getUnsafeOutboundUrlReason(value);
	if (reason) {
		throw new EverWorksUrlError(reason);
	}
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new EverWorksUrlError('Invalid URL format');
	}
	if (url.search || url.hash) {
		throw new EverWorksUrlError('The URL must not contain a query or fragment');
	}
	if (!options.allowInsecure && url.protocol !== 'https:') {
		throw new EverWorksUrlError('URL must use HTTPS');
	}
	let path = url.pathname.replace(/\/+$/, '');
	if (path.endsWith(EVER_WORKS_CONTRACT_PATH)) {
		path = path.slice(0, -EVER_WORKS_CONTRACT_PATH.length);
	}
	return `${url.protocol}//${url.host}${path}`;
}

/** An API base URL that cannot be used. The message is safe to show. */
export class EverWorksUrlError extends Error {
	constructor(reason: string) {
		super(`Invalid Ever Works API URL: ${reason}.`);
		this.name = 'EverWorksUrlError';
	}
}

/**
 * The Ever Works integration API client (contract v1, plan 03 Part B). Every call carries the key,
 * `User-Agent`, and — when set — `X-Scope-Slug`; every write `X-Sync-Origin`, and every create an
 * `Idempotency-Key`. 429, 5xx and network failures are retried with exponential back-off and jitter,
 * honouring `Retry-After`; a POST is retried only with an idempotency key (always present on creates).
 */
export class EverWorksClient {
	private readonly baseUrl: string;
	private readonly retry: EverWorksRetryPolicy;
	private readonly timeoutMs: number;
	private readonly sleep: (ms: number) => Promise<void>;
	private readonly random: () => number;

	constructor(private readonly options: EverWorksClientOptions) {
		this.baseUrl =
			normaliseApiBaseUrl(options.apiBaseUrl, { allowInsecure: options.allowInsecureBaseUrlForTests }) +
			EVER_WORKS_CONTRACT_PATH;
		this.retry = { ...DEFAULT_RETRY_POLICY, ...(options.retry ?? {}) };
		this.timeoutMs = options.timeoutMs ?? 15_000;
		this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
		this.random = options.random ?? Math.random;
	}

	/** The same client for another pinned organization (`X-Scope-Slug`). */
	withScope(scopeSlug: string | null): EverWorksClient {
		return new EverWorksClient({ ...this.options, scopeSlug });
	}

	/** `GET /whoami`: answers any valid key, needs no organization scope. */
	whoami(): Promise<EverWorksWhoami> {
		return this.request<EverWorksWhoami>('GET', '/whoami', { scopeSlug: null });
	}

	/** `GET /events`: the change feed after `after` (exclusive), our own origin excluded. */
	events(params: { after?: string | null; limit?: number; types?: string[]; excludeOrigin?: string | null }): Promise<EverWorksEventsPage> {
		return this.request<EverWorksEventsPage>('GET', '/events', {
			scopeSlug: null,
			query: {
				after: params.after ?? undefined,
				limit: params.limit,
				types: params.types?.length ? params.types.join(',') : undefined,
				excludeOrigin: params.excludeOrigin ?? undefined
			}
		});
	}

	/** `POST /webhooks`: the subscription with its signing secret (returned once). */
	createWebhook(body: EverWorksCreateWebhook, idempotencyKey: string): Promise<EverWorksWebhookSubscription> {
		return this.request<EverWorksWebhookSubscription>('POST', '/webhooks', { body, idempotencyKey, scopeSlug: null });
	}

	/** `GET /webhooks/:id`. */
	getWebhook(id: string): Promise<EverWorksWebhookSubscription> {
		return this.request<EverWorksWebhookSubscription>('GET', `/webhooks/${encodeURIComponent(id)}`, { scopeSlug: null });
	}

	/** `PATCH /webhooks/:id` (pause and resume). */
	updateWebhook(id: string, body: { status?: 'active' | 'paused'; events?: string[]; organizationIds?: string[]; excludeOriginTags?: string[] }): Promise<EverWorksWebhookSubscription> {
		return this.request<EverWorksWebhookSubscription>('PATCH', `/webhooks/${encodeURIComponent(id)}`, { body, scopeSlug: null });
	}

	/** `DELETE /webhooks/:id`. */
	async deleteWebhook(id: string): Promise<void> {
		await this.request<unknown>('DELETE', `/webhooks/${encodeURIComponent(id)}`, { scopeSlug: null });
	}

	/** Any contract call. Resolves with the parsed body of a 2xx; rejects with {@link EverWorksApiError} or {@link EverWorksNetworkError}. */
	async request<T>(method: EverWorksHttpRequest['method'], path: string, options: EverWorksRequestOptions = {}): Promise<T> {
		const isWrite = method !== 'GET';
		const idempotencyKey = method === 'POST' ? options.idempotencyKey ?? randomUUID() : options.idempotencyKey;
		if (idempotencyKey !== undefined && (idempotencyKey.length === 0 || idempotencyKey.length > 128)) {
			throw new RangeError('An Idempotency-Key is 1 to 128 characters.');
		}
		const headers: Record<string, string> = {
			Accept: 'application/json',
			Authorization: `Bearer ${this.options.apiKey}`,
			'User-Agent': EVER_WORKS_USER_AGENT
		};
		const scopeSlug = options.scopeSlug === undefined ? this.options.scopeSlug : options.scopeSlug;
		if (scopeSlug) headers['X-Scope-Slug'] = scopeSlug;
		if (isWrite && this.options.connectionId) headers['X-Sync-Origin'] = `gauzy:${this.options.connectionId}`;
		if (isWrite && options.actAsUserId) headers['X-Act-As-User'] = options.actAsUserId;
		if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
		if (options.ifMatchVersion !== undefined && method !== 'GET') headers['If-Match'] = `"${options.ifMatchVersion}"`;
		if (options.body !== undefined) headers['Content-Type'] = 'application/json';

		const request: EverWorksHttpRequest = {
			method,
			url: this.url(path, options.query),
			headers,
			body: options.body,
			timeoutMs: this.timeoutMs
		};
		const retrySafe = method !== 'POST' || !!idempotencyKey;

		for (let attempt = 1; ; attempt++) {
			let response: EverWorksHttpResponse;
			try {
				response = await this.options.transport.send(request);
			} catch (error) {
				const failure = new EverWorksNetworkError(EverWorksClient.networkReason(error));
				if (!retrySafe || attempt >= this.retry.maxAttempts) throw failure;
				await this.sleep(this.backoff(attempt, null));
				continue;
			}
			if (response.status >= 200 && response.status < 300) {
				return (response.status === 204 ? undefined : response.data) as T;
			}
			const failure = EverWorksClient.toApiError(response);
			if (!failure.retryable || !retrySafe || attempt >= this.retry.maxAttempts) throw failure;
			const retryAfterMs = failure.retryAfterSeconds === null ? null : failure.retryAfterSeconds * 1000;
			if (retryAfterMs !== null && retryAfterMs > this.retry.maxRetryAfterMs) throw failure;
			await this.sleep(this.backoff(attempt, retryAfterMs));
		}
	}

	private url(path: string, query?: EverWorksRequestOptions['query']): string {
		const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(query ?? {})) {
			if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
		}
		const search = params.toString();
		return search ? `${url}?${search}` : url;
	}

	/** Exponential back-off with jitter (50–100 % of the step), never less than `Retry-After`. */
	private backoff(attempt: number, retryAfterMs: number | null): number {
		const step = Math.min(this.retry.maxDelayMs, this.retry.baseDelayMs * 2 ** (attempt - 1));
		const jittered = Math.round(step * (0.5 + this.random() * 0.5));
		return retryAfterMs === null ? jittered : Math.max(jittered, retryAfterMs);
	}

	/** Maps a non-2xx response to an error carrying only the contract's code, message and details. */
	static toApiError(response: EverWorksHttpResponse): EverWorksApiError {
		const body = response.data as Partial<EverWorksErrorBody> | undefined;
		const error = body && typeof body === 'object' && body.error && typeof body.error === 'object' ? body.error : undefined;
		const code =
			typeof error?.code === 'string' && /^[a-z_]{1,64}$/.test(error.code) ? error.code : EverWorksClient.fallbackCode(response.status);
		const message =
			typeof error?.message === 'string' && error.message.length <= 2000 ? error.message : `Ever Works answered ${response.status}.`;
		const details = error?.details && typeof error.details === 'object' ? (error.details as Record<string, unknown>) : undefined;
		return new EverWorksApiError(response.status, code, message, details, EverWorksClient.retryAfter(response.headers['retry-after']));
	}

	private static fallbackCode(status: number): string {
		if (status === 401) return 'invalid_key';
		if (status === 403) return 'forbidden';
		if (status === 404) return 'not_found';
		if (status === 409) return 'conflict';
		if (status === 410) return 'cursor_expired';
		if (status === 412) return 'version_mismatch';
		if (status === 429) return 'rate_limited';
		if (status >= 500) return 'internal_error';
		return 'unexpected_status';
	}

	/** `Retry-After` as seconds (a number of seconds or an HTTP date), or `null`. */
	static retryAfter(value: string | undefined, now: number = Date.now()): number | null {
		if (!value) return null;
		const trimmed = value.trim();
		if (/^\d+$/.test(trimmed)) return Number(trimmed);
		const at = Date.parse(trimmed);
		return Number.isFinite(at) ? Math.max(0, Math.ceil((at - now) / 1000)) : null;
	}

	/** A short, safe reason for a failed exchange (the error code, never a URL or header). */
	private static networkReason(error: unknown): string {
		const code = (error as { code?: unknown })?.code;
		return typeof code === 'string' && /^[A-Z_]{2,40}$/.test(code) ? code : 'network_error';
	}
}
