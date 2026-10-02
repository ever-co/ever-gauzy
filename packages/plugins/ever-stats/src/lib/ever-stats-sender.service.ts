import { Inject, Injectable, Optional } from '@nestjs/common';
import type { EverStatsSigner } from '@gauzy/plugin-ever-instance';
import {
	MAX_STATS_REPORT_BYTES,
	MODULE_VERSION,
	STATS_HEADERS,
	STATS_REPORTS_PATH,
	STATS_SEND_TIMEOUT_MS,
	STATS_SIGNATURE_PREFIX
} from './ever-stats.constants';
import { STATS_SCHEMA } from './schema/stats-schema';
import { redactStatsPath } from './vendor/stats-checks';

/** Injection token: the `fetch` to send with (tests pass their own; default the global one). */
export const STATS_FETCH = 'EVER_STATS_FETCH';

/**
 * What to do after a send:
 * - `accepted` (202): stored by Ever Platform.
 * - `retry` (429, 5xx, no answer, timeout): try again at +1 h, +4 h, +12 h, then the next day.
 * - `reset_identity` (409 `key_mismatch`): the id is pinned to another key; nothing more is sent for
 *   this id until the operator resets the identity.
 * - `dropped` (400, 413, 415, 422): refused for good; nothing more is sent until the module is
 *   upgraded (a new `module_version`) or the identity is reset.
 * - `later` (404 while the platform does not take reports, a redirect, any other answer): the next day.
 */
export type StatsSendOutcome =
	| { kind: 'accepted'; status: 202 }
	| { kind: 'retry'; status: number | null; error: string; retryAfterS: number }
	| { kind: 'reset_identity'; status: 409; error: string }
	| { kind: 'dropped'; status: number; error: string }
	| { kind: 'later'; status: number; error: string };

/** The answer's problem code and first field, never a value. */
function problemSummary(status: number, body: unknown): string {
	const doc = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
	const code = typeof doc['code'] === 'string' && /^[a-z_]{1,64}$/.test(doc['code']) ? doc['code'] : null;
	const first = Array.isArray(doc['errors']) ? (doc['errors'][0] as Record<string, unknown> | undefined) : undefined;
	const path = typeof first?.['path'] === 'string' ? redactStatsPath(STATS_SCHEMA, first['path']) || '(body)' : null;
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

	/** The headers of a signed report (exported for tests and the settings page's documentation). */
	headers(bytes: Buffer, signer: EverStatsSigner, productVersion: string): Record<string, string> {
		const signature = signer.sign(bytes);
		if (signature.length !== 64) {
			throw new TypeError('an Ed25519 signature is 64 bytes');
		}
		return {
			'content-type': 'application/json',
			accept: 'application/json',
			'user-agent': `gauzy-ever-stats/${MODULE_VERSION} (gauzy/${productVersion})`,
			[STATS_HEADERS.key]: signer.publicKey,
			[STATS_HEADERS.signature]: `${STATS_SIGNATURE_PREFIX}${signature.toString('base64url')}`,
			[STATS_HEADERS.keyId]: signer.keyId
		};
	}

	async send(apiUrl: string, bytes: Buffer, signer: EverStatsSigner, productVersion: string): Promise<StatsSendOutcome> {
		if (bytes.length > MAX_STATS_REPORT_BYTES) {
			return { kind: 'dropped', status: 413, error: 'too_large:(body):too_large' };
		}
		let response: Response;
		try {
			response = await this.fetcher(`${apiUrl}${STATS_REPORTS_PATH}`, {
				method: 'POST',
				headers: this.headers(bytes, signer, productVersion),
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
			const text = await response.text();
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
