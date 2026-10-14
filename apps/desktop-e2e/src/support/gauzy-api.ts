/**
 * The few Gauzy REST calls the suite makes, with plain `fetch`: signing in, reading what the desktop
 * timer recorded, and the organization/employee settings the run depends on.
 */
export interface Session {
	token: string;
	tenantId: string;
	userId: string;
}

export class GauzyApi {
	readonly baseUrl: string;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	async login(email: string, password: string): Promise<Session> {
		const body = await this.request<any>('POST', '/api/auth/login', undefined, { email, password });
		if (!body?.token) throw new Error(`login of ${email} returned no token`);
		return { token: body.token, tenantId: body.user?.tenantId, userId: body.user?.id };
	}

	get<T = any>(session: Session, path: string, query?: Record<string, unknown>): Promise<T> {
		return this.request<T>('GET', path + toQuery(query), session);
	}

	put<T = any>(session: Session, path: string, body: unknown): Promise<T> {
		return this.request<T>('PUT', path, session, body);
	}

	/** Fetches an absolute or API-relative URL without credentials (how the web app loads a screenshot). */
	async fetchPublic(url: string): Promise<{ status: number; contentType: string; bytes: number }> {
		const res = await fetch(url.startsWith('http') ? url : `${this.baseUrl}${url}`);
		const buffer = Buffer.from(await res.arrayBuffer());
		return { status: res.status, contentType: res.headers.get('content-type') ?? '', bytes: buffer.length };
	}

	private async request<T>(method: string, path: string, session?: Session, body?: unknown): Promise<T> {
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (body !== undefined) headers['Content-Type'] = 'application/json';
		if (session) {
			headers['Authorization'] = `Bearer ${session.token}`;
			if (session.tenantId) headers['Tenant-Id'] = session.tenantId;
		}
		const res = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body)
		});
		const text = await res.text();
		if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
		return (text ? JSON.parse(text) : undefined) as T;
	}
}

/** Gauzy's query style: arrays as `key[0]=a&key[1]=b`, objects as `key[sub]=v`. */
export function toQuery(query?: Record<string, unknown>): string {
	if (!query) return '';
	const params = new URLSearchParams();
	const add = (key: string, value: unknown) => {
		if (value === undefined || value === null) return;
		if (Array.isArray(value)) value.forEach((v, i) => add(`${key}[${i}]`, v));
		else if (typeof value === 'object') for (const [k, v] of Object.entries(value)) add(`${key}[${k}]`, v);
		else params.append(key, String(value));
	};
	for (const [key, value] of Object.entries(query)) add(key, value);
	const text = params.toString();
	return text ? `?${text}` : '';
}

/** Retries `fn` until it stops throwing or `timeout` ms pass (the API answers health before its seed is usable). */
export async function eventually<T>(fn: () => Promise<T>, timeout: number, interval = 3_000): Promise<T> {
	const deadline = Date.now() + timeout;
	let last: unknown;
	while (Date.now() < deadline) {
		try {
			return await fn();
		} catch (error) {
			last = error;
			await new Promise((r) => setTimeout(r, interval));
		}
	}
	throw last;
}
