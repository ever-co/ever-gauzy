import { createHash } from 'crypto';
import type { IIdempotencyClaim, IIdempotencyKey, JsonData } from '@gauzy/contracts';

/**
 * The retry-safety decisions, kept apart from the transport that asks for them.
 *
 * A retryable request is answered one of five ways, and every one of those answers is a decision
 * about the *request*, not about Express, Apollo or the database: run the work, replay what the
 * first attempt returned, tell the caller to come back, refuse the key, or demand one. Keeping the
 * decision here — free of NestJS, of the ORM and of the kernel's storage — is what makes the
 * behaviour assertable against fixed inputs, which is the only way to be sure a retry cannot book
 * the same thing twice without standing up two databases and a race.
 *
 * The storage half lives in `IdempotencyService`: it owns the row, the unique tuple that acts as
 * the lock and the retention window. This module never touches a repository.
 */

/** Header a client presents its key in. */
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/** Header that marks a replayed response, so a client can tell a replay from a first answer. */
export const IDEMPOTENCY_REPLAYED_HEADER = 'Idempotency-Replayed';

/** Header carrying the ISO timestamp of the request whose response was replayed. */
export const IDEMPOTENCY_ORIGINAL_REQUEST_HEADER = 'Idempotency-Original-Request';

/** Header that tells a caller holding a live claim when to come back. */
export const RETRY_AFTER_HEADER = 'Retry-After';

/** Metadata key the `@Idempotent()` decorator writes and the interceptor reads. */
export const IDEMPOTENT_METADATA_KEY = 'IDEMPOTENT_METADATA';

/**
 * A key shorter than this is too easy to collide with by accident; a key longer than the column is
 * truncated by the database, which would silently merge two different keys into one.
 */
export const MIN_IDEMPOTENCY_KEY_LENGTH = 8;
export const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

/**
 * How much of a response is stored for replay.
 *
 * A response larger than this is answered with its status only: the alternative is a column that
 * grows without bound for the one request in a thousand that returns a big page.
 */
export const MAX_STORED_RESPONSE_BYTES = 1024 * 1024;

/** Retention window bounds, honoured by the cleanup job and by the per-route override. */
export const MIN_RETENTION_SECONDS = 60;
export const MAX_RETENTION_SECONDS = 7 * 24 * 60 * 60;

/** What the caller must do with the request, decided from the header and the stored key. */
export type IdempotencyPlan =
	| { action: 'SKIP' }
	| { action: 'REQUIRE_KEY' }
	| { action: 'INVALID_KEY'; reason: 'too-short' | 'too-long' }
	| { action: 'EXECUTE' }
	| { action: 'REPLAY'; status: number; body?: JsonData; replayedAt?: string }
	| { action: 'IN_FLIGHT'; retryAfterMs: number }
	| { action: 'REUSED_KEY'; expectedHashPrefix: string; actualHashPrefix: string };

/** The inputs the decision is made from. */
export interface IIdempotencyPlanInput {
	/** The HTTP method of the request. */
	method?: string;
	/** The raw header value, exactly as it arrived. */
	key?: unknown;
	/** Whether the operation declares the key mandatory. */
	required?: boolean;
	/** Hash of this request, needed to tell a replay from a key reuse. */
	requestHash?: string;
	/** The kernel's answer, absent before the key has been presented to storage. */
	claim?: Pick<IIdempotencyClaim, 'outcome' | 'response' | 'retryAfterMs'> & {
		record?: Pick<IIdempotencyKey, 'requestHash' | 'createdAt'>;
	};
}

/**
 * Whether a method may be repeated by definition.
 *
 * A read has nothing to duplicate, so a key on it is ignored rather than refused: refusing would
 * break a client that sets the header unconditionally on every call it makes.
 *
 * @param method The HTTP method.
 * @returns True for the methods that cannot create a second row.
 */
export function isSafeMethod(method?: string): boolean {
	const normalized = String(method ?? '').toUpperCase();

	return normalized === 'GET' || normalized === 'HEAD' || normalized === 'OPTIONS';
}

/**
 * Reads the key off a header value.
 *
 * Express hands a repeated header over as an array; the first value is the one the client
 * addressed to this request. Whitespace is trimmed because a header may legally carry it and a
 * client that sends it twice with different padding means the same key.
 *
 * @param value The raw header value.
 * @returns The normalized key, or null when no usable value was sent.
 */
export function normalizeIdempotencyKey(value: unknown): string | null {
	const candidate = Array.isArray(value) ? value[0] : value;

	if (typeof candidate !== 'string') {
		return null;
	}

	const trimmed = candidate.trim();

	return trimmed.length > 0 ? trimmed : null;
}

/**
 * Whether a key is within the length the column and the lookup can carry.
 *
 * @param key The normalized key.
 * @returns True when the key may be stored and found again.
 */
export function isValidIdempotencyKey(key: string): boolean {
	return key.length >= MIN_IDEMPOTENCY_KEY_LENGTH && key.length <= MAX_IDEMPOTENCY_KEY_LENGTH;
}

/**
 * The first eight characters of a hash.
 *
 * A conflict is explained by comparing two request hashes, and the comparison has to be visible in
 * a bug report without printing the request bodies that produced them. Eight hex characters are
 * enough to tell two bodies apart and useless for reconstructing either.
 *
 * @param hash The hash to shorten.
 * @returns The short form.
 */
export function hashPrefix(hash?: string): string {
	return typeof hash === 'string' ? hash.slice(0, 8) : '';
}

/**
 * Serializes a value with a stable key order, so the same body always hashes the same.
 *
 * A retry re-sends the same body, but a client that rebuilds its JSON — or a proxy that reorders
 * keys — must still produce the same hash, otherwise the retry looks like a different request and
 * is refused as a reused key. `JSON.stringify` preserves insertion order, which is exactly what a
 * rebuilt object does not.
 *
 * @param value The value to serialize.
 * @returns A deterministic string.
 */
export function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') {
		return JSON.stringify(value) ?? 'null';
	}

	if (value instanceof Date) {
		return JSON.stringify(value.toISOString());
	}

	if (Array.isArray(value)) {
		return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
	}

	const record = value as Record<string, unknown>;
	const keys = Object.keys(record).sort();

	return `{${keys
		.filter((key) => record[key] !== undefined)
		.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
		.join(',')}}`;
}

/**
 * Canonicalizes the query string of a request.
 *
 * Query parameters arrive in whatever order the client wrote them, and two of those orders are the
 * same request. Sorting the keys is what keeps a retry from looking like a different query.
 *
 * @param query The parsed query object, or the raw query string.
 * @returns A deterministic string.
 */
export function canonicalizeQuery(query: unknown): string {
	if (query === undefined || query === null) {
		return '';
	}

	if (typeof query === 'string') {
		return query;
	}

	return stableStringify(query);
}

/**
 * Hashes what makes two requests the same request.
 *
 * Method, path, query and body together — because the same key presented to the same scope for a
 * different body is not a retry, and answering it with the first response would answer a question
 * the caller never asked. The raw body is preferred over the parsed one: it is what the client
 * actually sent, and it is available because the platform already captures it for signature
 * verification.
 *
 * @param request The request fingerprint.
 * @returns The hex sha-256 of the canonicalized request.
 */
export function buildRequestHash(request: {
	method?: string;
	path?: string;
	query?: unknown;
	rawBody?: string | Buffer | null;
	body?: unknown;
}): string {
	const body =
		request.rawBody !== undefined && request.rawBody !== null
			? Buffer.isBuffer(request.rawBody)
				? request.rawBody.toString('utf8')
				: String(request.rawBody)
			: stableStringify(request.body ?? null);

	const canonical = JSON.stringify([
		String(request.method ?? '').toUpperCase(),
		request.path ?? '',
		canonicalizeQuery(request.query),
		body
	]);

	return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Prepares a response body for storage.
 *
 * A body over the cap is not stored at all rather than stored truncated: half a JSON document
 * cannot be replayed, and a caller that received half of one would have no way to tell.
 *
 * @param body The response body.
 * @param capBytes The maximum size to store.
 * @returns The body to store, and whether it was dropped for size.
 */
export function serializeResponseForStorage(
	body: unknown,
	capBytes: number = MAX_STORED_RESPONSE_BYTES
): { stored?: JsonData; dropped: boolean } {
	if (body === undefined || body === null) {
		return { dropped: false };
	}

	let serialized: string;

	try {
		serialized = JSON.stringify(body) ?? '';
	} catch {
		// A body that cannot be serialized cannot be replayed either. Storing the status alone is
		// the honest answer; the alternative is failing a request whose work already succeeded.
		return { dropped: true };
	}

	if (Buffer.byteLength(serialized, 'utf8') > capBytes) {
		return { dropped: true };
	}

	return { stored: JSON.parse(serialized) as JsonData, dropped: false };
}

/**
 * Clamps a retention override to the supported window.
 *
 * @param seconds The requested retention, in seconds.
 * @returns The accepted retention, in seconds, or undefined when nothing was requested.
 */
export function clampRetentionSeconds(seconds?: number): number | undefined {
	if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
		return undefined;
	}

	return Math.min(MAX_RETENTION_SECONDS, Math.max(MIN_RETENTION_SECONDS, Math.floor(seconds)));
}

/**
 * Decides what to do with a request that may carry an idempotency key.
 *
 * Called twice per request: once before the key is presented to storage (no `claim`), which
 * validates the header and says whether the work may run at all, and once with the kernel's answer,
 * which says whether the work must run, is already running, or has already been answered. Both
 * calls are the same function on purpose — the rules for "may this run" and "has this run" belong
 * together, and splitting them is how the two drift apart.
 *
 * @param input The request and, once available, the kernel's claim.
 * @returns The action the caller must take.
 */
export function planIdempotentRequest(input: IIdempotencyPlanInput): IdempotencyPlan {
	if (isSafeMethod(input.method)) {
		// A read cannot duplicate anything, so a key on it means nothing. Ignoring it keeps a client
		// that sets the header on every call working.
		return { action: 'SKIP' };
	}

	const key = normalizeIdempotencyKey(input.key);

	if (!key) {
		return input.required ? { action: 'REQUIRE_KEY' } : { action: 'SKIP' };
	}

	if (key.length < MIN_IDEMPOTENCY_KEY_LENGTH) {
		return { action: 'INVALID_KEY', reason: 'too-short' };
	}

	if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
		return { action: 'INVALID_KEY', reason: 'too-long' };
	}

	if (!input.claim) {
		return { action: 'EXECUTE' };
	}

	// The values are the contract's `IdempotencyOutcome` members; compared as strings so this
	// module carries no runtime dependency on the contracts package.
	switch (String(input.claim.outcome ?? '')) {
		case 'CLAIMED':
			return { action: 'EXECUTE' };

		case 'REPLAYED':
			return {
				action: 'REPLAY',
				status: input.claim.response?.status ?? 200,
				body: input.claim.response?.body,
				replayedAt: toIsoString(input.claim.record?.createdAt)
			};

		case 'IN_FLIGHT':
			return { action: 'IN_FLIGHT', retryAfterMs: Math.max(0, input.claim.retryAfterMs ?? 0) };

		case 'REUSED_KEY':
			return {
				action: 'REUSED_KEY',
				expectedHashPrefix: hashPrefix(input.claim.record?.requestHash),
				actualHashPrefix: hashPrefix(input.requestHash)
			};

		default:
			// An outcome this build does not know is not a licence to run the work twice.
			return input.claim ? { action: 'IN_FLIGHT', retryAfterMs: 0 } : { action: 'EXECUTE' };
	}
}

/**
 * Renders a stored timestamp as an ISO string.
 *
 * @param value The stored value, which may be a Date or an already serialized string.
 * @returns The ISO string, or undefined when there is nothing to render.
 */
function toIsoString(value?: Date | string): string | undefined {
	if (!value) {
		return undefined;
	}

	const date = value instanceof Date ? value : new Date(value);

	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
