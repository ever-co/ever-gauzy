import { Inject, Injectable, Optional } from '@nestjs/common';
import { signStatsReportBytes, StatsValidationError } from '@ever-co/connect-sdk';
import type { EverStatsSigner } from '@gauzy/plugin-ever-instance';
import {
	MAX_STATS_REPORT_BYTES,
	MAX_STATS_RESPONSE_BYTES,
	MODULE_VERSION,
	STATS_REPORTS_PATH,
	STATS_SEND_TIMEOUT_MS
} from './ever-stats.constants';
import { redactStatsPath } from './schema/stats-path';

/** Injection token: the `fetch` to send with (tests pass their own; default the global one). */
export const STATS_FETCH = 'EVER_STATS_FETCH';

/**
 * What to do after a send:
 * - `accepted` (202): stored by Ever Platform.
 * - `retry` (429, 5xx, no answer, timeout): try again at +1 h, +4 h, +12 h, then the next day.
 * - `reset_identity` (409 `key_mismatch`): the id is pinned to another key; nothing more is sent for
 *   this id until the operator resets the identity.
 * - `dropped` (400, 413, 415, 422): refused; nothing more is sent for this module version, Gauzy
 *   release and identity (for at most 7 days after a 400, 413 or 415).
 * - `later` (404 while the platform does not take reports, a redirect, any other answer): the next day.
 */
export type StatsSendOutcome =
	| { kind: 'accepted'; status: 202 }
	| { kind: 'retry'; status: number | null; error: string; retryAfterS: number }
	| { kind: 'reset_identity'; status: 409; error: string }
	| { kind: 'dropped'; status: number; error: string }
	| { kind: 'later'; status: number; error: string };

/**
 * The answer body as text, read up to `MAX_STATS_RESPONSE_BYTES`; `null` when it is longer (the rest
 * is not read) or unreadable. A hostile or broken endpoint cannot make the API buffer more.
 */
export async function readCappedBody(response: Response, cap = MAX_STATS_RESPONSE_BYTES): Promise<string | null> {
	const declared = Number(response.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > cap) {
		await response.body?.cancel().catch(() => undefined);
		return null;
	}
	if (!response.body) {
		return '';
	}
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > cap) {
				await reader.cancel().catch(() => undefined);
				return null;
			}
			chunks.push(value);
		}
	} catch {
		return null;
	}
	return Buffer.concat(chunks).toString('utf8');
}

/** The answer's problem code and first field, never a value. */
function problemSummary(status: number, body: unknown): string {
	const doc = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
	const code = typeof doc['code'] === 'string' && /^[a-z_]{1,64}$/.test(doc['code']) ? doc['code'] : null;
	const first = Array.isArray(doc['errors']) ? (doc['errors'][0] as Record<string, unknown> | undefined) : undefined;
	const path = typeof first?.['path'] === 'string' ? redactStatsPath(first['path']) || '(body)' : null;
	const fieldCode = typeof first?.['code'] === 'string' && /^[a-z_]{1,32}$/.test(first['code']) ? first['code'] : null;
	return [`http_${status}`, code, path, fieldCode].filter(Boolean).join(':').slice(0, 255);
}

/**
 * The one outbound call of the anonymous usage statistics: `POST {EVER_STATS_API_URL}/v1/stats/reports`
 * with exactly the stored bytes, the statistics public key and the signature. No credential, no
 * cookie, no redirect followed, 10 s timeout.
 */
@Injectable()
export class EverStatsSender {
	private readonly fetcher: typeof fetch;

	constructor(@Optional() @Inject(STATS_FETCH) fetcher?: typeof fetch) {
		this.fetcher = fetcher ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
	}

	/**
	 * The headers of a signed report (exported for tests and the settings page's documentation): the
	 * SDK signs exactly `bytes` (`signStatsReportBytes`: the key, the signature and the key id, after
	 * the platform's checks); this module adds its user agent. Throws the SDK's
	 * `StatsValidationError` for bytes the platform would refuse.
	 */
	headers(bytes: Buffer, signer: EverStatsSigner, productVersion: string): Record<string, string> {
		const signed = signStatsReportBytes(new Uint8Array(bytes), signer, { keyId: true });
		return {
			...signed.headers,
			accept: 'application/json',
			'user-agent': `gauzy-ever-stats/${MODULE_VERSION} (gauzy/${productVersion})`
		};
	}

	async send(apiUrl: string, bytes: Buffer, signer: EverStatsSigner, productVersion: string): Promise<StatsSendOutcome> {
		if (bytes.length > MAX_STATS_REPORT_BYTES) {
			return { kind: 'dropped', status: 413, error: 'too_large:(body):too_large' };
		}
		let headers: Record<string, string>;
		try {
			headers = this.headers(bytes, signer, productVersion);
		} catch (error) {
			if (error instanceof StatsValidationError) {
				// Ever Platform would refuse these bytes: nothing is sent.
				const first = error.errors[0];
				const path = first ? redactStatsPath(first.path) || '(body)' : '(body)';
				return { kind: 'dropped', status: error.status, error: `http_${error.status}:${error.code}:${path}:${first?.code ?? 'type'}`.slice(0, 255) };
			}
			throw error;
		}
		let response: Response;
		try {
			response = await this.fetcher(`${apiUrl}${STATS_REPORTS_PATH}`, {
				method: 'POST',
				headers,
				body: new Uint8Array(bytes),
				redirect: 'manual',
				credentials: 'omit',
				signal: AbortSignal.timeout(STATS_SEND_TIMEOUT_MS)
			});
		} catch (error) {
			const timeout = (error as { name?: string })?.name === 'TimeoutError';
			return { kind: 'retry', status: null, error: timeout ? 'timeout' : 'connection_error', retryAfterS: 0 };
		}
		let body: unknown = null;
		try {
			const text = await readCappedBody(response);
			body = text ? JSON.parse(text) : null;
		} catch {
			body = null;
		}
		const status = response.status;
		const error = problemSummary(status, body);
		if (status === 202) {
			return { kind: 'accepted', status: 202 };
		}
		if (status === 409 && (body as Record<string, unknown> | null)?.['code'] === 'key_mismatch') {
			return { kind: 'reset_identity', status: 409, error };
		}
		if (status === 429 || status >= 500) {
			const header = response.headers.get('retry-after');
			const retryAfterS = header && /^\d{1,7}$/.test(header.trim()) ? Number(header.trim()) : 0;
			return { kind: 'retry', status, error, retryAfterS };
		}
		if (status === 400 || status === 413 || status === 415 || status === 422) {
			return { kind: 'dropped', status, error };
		}
		return { kind: 'later', status, error };
	}
}
