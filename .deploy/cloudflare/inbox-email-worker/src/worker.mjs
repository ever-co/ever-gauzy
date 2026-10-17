// cspell:ignore authserv
/**
 * Gauzy Inbox — Cloudflare Email Worker (plan 04 §5.2, G-P4-3).
 *
 * Cloudflare Email Routing hands every message for the platform mailbox domain (`GAUZY_INBOX_DOMAIN`, a catch-all
 * route) to this Worker, which posts it to the Gauzy API's generic inbound route
 * (`POST <GAUZY_INBOX_API_URL>/api/inbox/inbound/generic/platform`):
 *
 *   { "raw": "<base64 RFC 5322>", "envelope": { "from": "…", "to": ["…"] }, "authenticationResults": "…" }
 *
 * signed with the platform secret (`GAUZY_INBOX_PLATFORM_SECRET`, at least 24 characters, the same value as the API's):
 * `X-Gauzy-Inbox-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`. The API answers 202
 * `{ accepted, duplicates, dropped }`.
 *
 * - Only Cloudflare's own verdicts are forwarded: the topmost authentication header (`Authentication-Results` or
 *   `ARC-Authentication-Results`), when its authserv-id is `GAUZY_INBOX_TRUSTED_AUTHSERV_ID` (default
 *   `mx.cloudflare.net`). A sender's own header, or an earlier hop's, lies below it and is never forwarded.
 * - Only the API's own acknowledgement (202 with its counters) counts as stored; a redirect is never followed.
 * - A message over `GAUZY_INBOX_MAX_MESSAGE_BYTES` (default 25 MB, as the API's) is rejected before it is read.
 * - A delivery no mailbox took (nothing accepted, nothing a duplicate) is rejected: the sender gets a bounce.
 * - 413 and the API's other definite refusals reject the message; a network error, a 5xx, a 429, a 401 or a 404 (the
 *   platform route shut, or a secret mismatch: configuration, fixed on our side) throws, so the sending server keeps
 *   the message and retries later. No message is lost to a misconfiguration.
 *
 * No dependencies: Web Crypto, `fetch` and `Response` of the Workers runtime (also in Node 20+, where the tests run).
 */

export const SIGNATURE_HEADER = 'x-gauzy-inbox-signature';
export const INBOUND_PATH = '/api/inbox/inbound/generic/platform';
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_AUTHSERV_ID = 'mx.cloudflare.net';
const MIN_SECRET_LENGTH = 24;
/** How much of the message is read for its headers. */
const HEADER_SCAN_BYTES = 256 * 1024;

/** Statuses that mean "try again later" (the sending server keeps the message): ours to fix, or transient. */
const RETRY_STATUSES = new Set([401, 404, 408, 425, 429]);

export default {
	async email(message, env) {
		await deliver(message, env);
	}
};

/** The Worker's settings, checked (a missing one throws: the sender retries while it is fixed). */
export function settingsOf(env) {
	const apiUrl = String(env?.GAUZY_INBOX_API_URL ?? '')
		.trim()
		.replace(/\/+$/, '');
	const secret = String(env?.GAUZY_INBOX_PLATFORM_SECRET ?? '');
	if (!/^https:\/\/[^/]+/.test(apiUrl))
		throw new Error('GAUZY_INBOX_API_URL must be the https URL of the Gauzy API.');
	if (secret.length < MIN_SECRET_LENGTH) {
		throw new Error(`GAUZY_INBOX_PLATFORM_SECRET must be set (at least ${MIN_SECRET_LENGTH} characters).`);
	}
	const max = Number(env?.GAUZY_INBOX_MAX_MESSAGE_BYTES);
	return {
		apiUrl,
		secret,
		maxBytes: Number.isFinite(max) && max > 0 ? Math.floor(max) : DEFAULT_MAX_BYTES,
		authservId: String(env?.GAUZY_INBOX_TRUSTED_AUTHSERV_ID || DEFAULT_AUTHSERV_ID)
			.trim()
			.toLowerCase()
	};
}

/**
 * Posts one message to the API.
 *
 * @param message Cloudflare's `ForwardableEmailMessage` (`from`, `to`, `raw`, `rawSize`, `setReject`).
 * @param env The Worker's variables and secrets.
 * @param fetcher `fetch` (replaced in tests).
 * @returns What happened: `accepted`, `rejected` (with the reason), or it throws (the sender retries).
 */
export async function deliver(message, env, fetcher = fetch) {
	const settings = settingsOf(env);
	if (Number(message.rawSize) > settings.maxBytes) {
		return reject(message, 'Message too large');
	}
	const raw = new Uint8Array(await new Response(message.raw).arrayBuffer());
	if (raw.length > settings.maxBytes) {
		return reject(message, 'Message too large');
	}
	const authenticationResults = trustedAuthenticationResults(raw, settings.authservId);
	const body = JSON.stringify({
		raw: toBase64(raw),
		envelope: { from: String(message.from ?? ''), to: [String(message.to ?? '')] },
		...(authenticationResults ? { authenticationResults } : {})
	});
	const timestamp = Math.floor(Date.now() / 1000);
	const signature = await hmacSha256Hex(settings.secret, `${timestamp}.${body}`);

	const response = await fetcher(`${settings.apiUrl}${INBOUND_PATH}`, {
		method: 'POST',
		// The signed message goes to the configured API only, never where a redirect points.
		redirect: 'error',
		headers: { 'content-type': 'application/json', [SIGNATURE_HEADER]: `t=${timestamp},v1=${signature}` },
		body
	});
	if (response.status >= 200 && response.status < 300) {
		// Only the API's own acknowledgement counts (202 with its counters): anything else in front of it (a proxy's
		// HTML page) is no proof the mail was stored, so the sender keeps it and retries.
		const result = await response.json().catch(() => null);
		const counted = (key) => Number.isInteger(result?.[key]) && result[key] >= 0;
		if (response.status !== 202 || !counted('accepted') || !counted('duplicates') || !counted('dropped')) {
			throw new Error(
				`The Gauzy API answered ${response.status} without a delivery result; the sending server retries later.`
			);
		}
		if (result.accepted === 0 && result.duplicates === 0) {
			return reject(message, 'No such mailbox');
		}
		return { outcome: 'accepted', result };
	}
	if (response.status === 413) return reject(message, 'Message too large');
	if (response.status >= 400 && response.status < 500 && !RETRY_STATUSES.has(response.status)) {
		return reject(message, `Refused by the inbox (${response.status})`);
	}
	throw new Error(`The Gauzy API answered ${response.status}; the sending server retries later.`);
}

function reject(message, reason) {
	message.setReject(reason);
	return { outcome: 'rejected', reason };
}

/**
 * The verdicts the receiving MX added: the topmost authentication header, `Authentication-Results` or
 * `ARC-Authentication-Results` (its `i=` instance stripped), when its authserv-id is the trusted one, else nothing.
 * The MX prepends its headers, so the topmost one is its own; a header of an earlier hop (or the sender's) lies below
 * it and is never read.
 */
export function trustedAuthenticationResults(raw, authservId = DEFAULT_AUTHSERV_ID) {
	const head = latin1(raw.subarray(0, Math.min(raw.length, HEADER_SCAN_BYTES)));
	const end = head.search(/\r?\n\r?\n/);
	const lines = (end >= 0 ? head.slice(0, end) : head).replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/);
	const line = lines.find((entry) => /^(arc-)?authentication-results:/i.test(entry));
	if (line === undefined) return undefined;
	const colon = line.indexOf(':');
	const arc = /^arc-/i.test(line);
	const value = arc
		? line
				.slice(colon + 1)
				.trim()
				.replace(/^i=\d+\s*;\s*/i, '')
		: line.slice(colon + 1).trim();
	const id = value.split(';', 1)[0].trim().toLowerCase();
	return id === authservId.toLowerCase() ? value.slice(0, 2000) : undefined;
}

function latin1(bytes) {
	let text = '';
	for (let index = 0; index < bytes.length; index += 0x8000) {
		text += String.fromCharCode.apply(null, bytes.subarray(index, index + 0x8000));
	}
	return text;
}

export function toBase64(bytes) {
	return btoa(latin1(bytes));
}

export async function hmacSha256Hex(secret, text) {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign'
	]);
	const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(text)));
	return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
