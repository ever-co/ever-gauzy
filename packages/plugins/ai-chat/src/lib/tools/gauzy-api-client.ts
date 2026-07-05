import { Logger } from '@nestjs/common';

/**
 * Minimal HTTP client the AI agent's server tools use to call the Gauzy
 * REST API **as the requesting user**: the user's own `Authorization`
 * header is forwarded verbatim, so the platform's guards enforce the
 * exact same RBAC / tenant / organization rules as any other client.
 *
 * The base URL defaults to the API itself (self-call). Override with
 * `GAUZY_AI_CHAT_SELF_API_URL` when the pod cannot reach its public URL.
 */
export class GauzyApiClient {
	private static readonly logger = new Logger('AiChatGauzyApiClient');
	private readonly baseUrl: string;

	constructor(
		private readonly authorizationHeader: string,
		/**
		 * Extra headers forwarded on every call — in particular `Tenant-Id`
		 * and `Organization-Id`, which the platform's tenant guards expect
		 * alongside the JWT (same as the web app's HTTP interceptor sends).
		 */
		private readonly extraHeaders: Record<string, string> = {}
	) {
		const base =
			process.env.GAUZY_AI_CHAT_SELF_API_URL ||
			process.env.API_BASE_URL ||
			`http://127.0.0.1:${process.env.API_PORT || 3000}`;
		this.baseUrl = base.replace(/\/+$/, '');
	}

	/** GET a Gauzy API path (e.g. '/api/tasks/me') with optional query params. */
	async get<T = unknown>(path: string, query?: Record<string, unknown>): Promise<T> {
		return this.request<T>('GET', path, query);
	}

	/** POST to a Gauzy API path with a JSON body. */
	async post<T = unknown>(path: string, body?: unknown): Promise<T> {
		return this.request<T>('POST', path, undefined, body);
	}

	/** PUT to a Gauzy API path with a JSON body. */
	async put<T = unknown>(path: string, body?: unknown): Promise<T> {
		return this.request<T>('PUT', path, undefined, body);
	}

	private async request<T>(
		method: string,
		path: string,
		query?: Record<string, unknown>,
		body?: unknown
	): Promise<T> {
		const url = new URL(this.baseUrl + (path.startsWith('/') ? path : `/${path}`));
		for (const [key, value] of Object.entries(query ?? {})) {
			if (value === undefined || value === null) continue;
			url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
		}

		const response = await fetch(url, {
			method,
			headers: {
				Authorization: this.authorizationHeader,
				...this.extraHeaders,
				'Content-Type': 'application/json'
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {})
		});

		const text = await response.text();
		if (!response.ok) {
			GauzyApiClient.logger.warn(`${method} ${url.pathname} -> ${response.status}`);
			// Surface a compact, model-friendly error (no HTML dumps).
			let detail = text.slice(0, 500);
			try {
				const parsed = JSON.parse(text);
				detail = parsed?.message ? String(parsed.message) : detail;
			} catch {
				/* keep raw slice */
			}
			throw new Error(`Gauzy API ${response.status} on ${method} ${url.pathname}: ${detail}`);
		}
		try {
			return JSON.parse(text) as T;
		} catch {
			return text as unknown as T;
		}
	}
}
