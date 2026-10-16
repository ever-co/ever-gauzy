import { getUnsafeOutboundUrlReason } from '@gauzy/utils';

/** The Resend API (https only, no redirects followed). */
export const RESEND_API_BASE_URL = 'https://api.resend.com';
/** The most bytes read from one download (a received message, an attachment). */
export const RESEND_MAX_DOWNLOAD_BYTES = 40 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

/** What `fetch` the client uses (the global one; a spec passes a recorder). */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** A Resend API error, with the status and Resend's own error name (never the API key). */
export class ResendApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string
	) {
		super(message);
		this.name = 'ResendApiError';
	}
}

/** An attachment of a received email, as the Receiving API lists it. */
export interface ResendReceivedAttachment {
	id: string;
	filename?: string;
	content_type?: string;
	content_disposition?: string;
	content_id?: string;
	size?: number;
	download_url?: string;
}

/** A received email, as `GET /emails/receiving/:id` answers it. */
export interface ResendReceivedEmail {
	id: string;
	from?: string;
	to?: string[];
	cc?: string[];
	bcc?: string[];
	reply_to?: string[];
	subject?: string;
	html?: string | null;
	text?: string | null;
	headers?: Record<string, string>;
	message_id?: string;
	created_at?: string;
	attachments?: ResendReceivedAttachment[];
	/** The raw message, when Resend offers it (a short-lived signed URL). */
	raw?: { download_url?: string; expires_at?: string } | null;
}

/** `POST /emails`. */
export interface ResendSendRequest {
	from: string;
	to: string[];
	cc?: string[];
	bcc?: string[];
	reply_to?: string[];
	subject: string;
	html?: string;
	text?: string;
	headers?: Record<string, string>;
	attachments?: Array<{ filename: string; content: string; content_type?: string; content_id?: string }>;
}

/**
 * The few Resend API calls the plugin makes, with the account's API key: send, list domains (the connection test), and
 * the Receiving API (a received email, its attachments). Every URL is https; downloads are size-capped and checked
 * against the SSRF rules (no private, loopback or link-local host) before they are fetched, and redirects are refused.
 */
export class ResendApiClient {
	constructor(
		private readonly apiKey: string,
		private readonly fetcher: FetchLike = (url, init) => fetch(url, init),
		private readonly baseUrl = RESEND_API_BASE_URL
	) {
		if (!apiKey) throw new ResendApiError(0, 'missing_api_key', 'The Resend account has no API key.');
	}

	async send(request: ResendSendRequest, idempotencyKey?: string): Promise<{ id: string }> {
		const answer = await this.json<{ id?: string }>('POST', '/emails', request, idempotencyKey);
		if (!answer?.id) throw new ResendApiError(502, 'invalid_response', 'Resend accepted the email without an id.');
		return { id: answer.id };
	}

	async listDomains(): Promise<Array<{ name?: string; status?: string }>> {
		const answer = await this.json<{ data?: Array<{ name?: string; status?: string }> }>('GET', '/domains');
		return Array.isArray(answer?.data) ? answer.data : [];
	}

	async receivedEmail(id: string): Promise<ResendReceivedEmail> {
		return this.json<ResendReceivedEmail>('GET', `/emails/receiving/${encodeURIComponent(id)}`);
	}

	async receivedAttachments(id: string): Promise<ResendReceivedAttachment[]> {
		const answer = await this.json<{ data?: ResendReceivedAttachment[] }>(
			'GET',
			`/emails/receiving/${encodeURIComponent(id)}/attachments`
		);
		return Array.isArray(answer?.data) ? answer.data : [];
	}

	/** Downloads a signed URL the API answered (an attachment, the raw message). */
	async download(url: string, maxBytes = RESEND_MAX_DOWNLOAD_BYTES): Promise<Buffer> {
		const unsafe = getUnsafeOutboundUrlReason(url);
		if (unsafe)
			throw new ResendApiError(0, 'unsafe_url', `Resend answered a download URL that is not allowed: ${unsafe}.`);
		const response = await this.fetcher(url, {
			method: 'GET',
			redirect: 'error',
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!response.ok)
			throw new ResendApiError(
				response.status,
				'download_failed',
				`A Resend download answered ${response.status}.`
			);
		const declared = Number(response.headers.get('content-length') ?? '0');
		if (declared > maxBytes)
			throw new ResendApiError(413, 'too_large', 'A Resend download is larger than allowed.');
		// Read in chunks and stop at the cap: a response without a length must not grow without bound.
		if (!response.body) return Buffer.alloc(0);
		const reader = response.body.getReader();
		const chunks: Buffer[] = [];
		let total = 0;
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > maxBytes) {
				await reader.cancel().catch(() => undefined);
				throw new ResendApiError(413, 'too_large', 'A Resend download is larger than allowed.');
			}
			chunks.push(Buffer.from(value));
		}
		return Buffer.concat(chunks, total);
	}

	private async json<T>(method: 'GET' | 'POST', path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
		const response = await this.fetcher(`${this.baseUrl}${path}`, {
			method,
			redirect: 'error',
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				Accept: 'application/json',
				...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
				...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey.slice(0, 256) } : {})
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {})
		});
		const text = await response.text();
		let data: unknown = null;
		try {
			data = text ? JSON.parse(text) : null;
		} catch {
			data = null;
		}
		if (!response.ok) {
			const error = (data ?? {}) as { name?: string; message?: string };
			throw new ResendApiError(
				response.status,
				typeof error.name === 'string' ? error.name : 'http_error',
				typeof error.message === 'string' ? error.message.slice(0, 300) : `Resend answered ${response.status}.`
			);
		}
		return data as T;
	}
}
