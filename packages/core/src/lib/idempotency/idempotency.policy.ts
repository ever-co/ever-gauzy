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

/**
 * The member an input carries its retry key in.
 *
 * A GraphQL request is one `POST` carrying as many mutations as the document selects, so a header
 * could neither say which of three mutations a key belongs to nor carry three of them. The key
 * therefore rides beside the input it qualifies, and this is the member name it rides under.
 */
export const IDEMPOTENCY_KEY_MEMBER = 'idempotencyKey';

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
 * A raw string is parsed before it is sorted, for the same reason the parsed object is: a client
 * that rebuilds its URL writes the same parameters in whatever order its own map iterates, and
 * leaving a string alone applied the sorting to one spelling of a query and not to the other. A
 * repeated key keeps the order its values were written in, because `?tag=a&tag=b` and `?tag=b&tag=a`
 * are two different lists to every parser the platform hands them to.
 *
 * @param query The parsed query object, or the raw query string.
 * @returns A deterministic string.
 */
export function canonicalizeQuery(query: unknown): string {
	if (query === undefined || query === null) {
		return '';
	}

	if (typeof query === 'string') {
		const trimmed = query.startsWith('?') ? query.slice(1) : query;

		if (trimmed === '') {
			return '';
		}

		const grouped: Record<string, string[]> = {};

		for (const [key, value] of new URLSearchParams(trimmed)) {
			if (!grouped[key]) {
				grouped[key] = [];
			}
			grouped[key].push(value);
		}

		return stableStringify(
			Object.fromEntries(
				Object.keys(grouped).map((key) => [key, grouped[key].length === 1 ? grouped[key][0] : grouped[key]])
			)
		);
	}

	return stableStringify(query);
}

/**
 * Strips the query and the fragment off a request path.
 *
 * The interceptor reads `originalUrl`, which carries the query string, and the query is already
 * hashed on its own through {@link canonicalizeQuery}. Hashing it twice would be harmless; hashing
 * it twice *in two different canonical forms* is not — the sorted form agrees between two spellings
 * of one request while the copy embedded in the path disagrees, and the retry is then refused as a
 * reused key.
 *
 * @param path The path as the transport presented it.
 * @returns The path alone.
 */
export function canonicalizePath(path: unknown): string {
	const value = String(path ?? '');
	const queryAt = value.indexOf('?');
	const fragmentAt = value.indexOf('#');
	const end = Math.min(queryAt === -1 ? value.length : queryAt, fragmentAt === -1 ? value.length : fragmentAt);

	return value.slice(0, end);
}

/**
 * Canonicalizes the body of a request.
 *
 * **The parsed body is the request; the raw bytes are only its spelling.** A retry is a retry when
 * it asks for the same thing, and a client that rebuilds its JSON — or a proxy, a gateway or an SDK
 * that re-serialises it — writes the same members with a different key order, different whitespace
 * and a different number format. Hashing the bytes made every one of those look like a different
 * request, so the retry this mechanism exists to make safe was refused as a reused key, which is the
 * one outcome the caller cannot recover from: it has no response, and it may not ask again.
 *
 * The raw bytes are still what is hashed when there is nothing parsed to hash. A payload the
 * platform did not parse into an object has no structure to canonicalize, and its bytes are then the
 * only honest fingerprint it has; when those bytes do turn out to be JSON they go through the same
 * canonical rule as everything else, so the two paths cannot disagree about one request.
 *
 * @param request The body as the transport presented it, parsed and raw.
 * @returns A deterministic string.
 */
export function canonicalizeBody(request: { rawBody?: string | Buffer | null; body?: unknown }): string {
	const parsed = request.body;
	const parsedIsEmptyObject =
		parsed !== null &&
		typeof parsed === 'object' &&
		!Array.isArray(parsed) &&
		Object.keys(parsed as Record<string, unknown>).length === 0;

	// `express.json()` leaves `{}` behind for a request whose body it did not parse, so an empty
	// object is not evidence that nothing was sent. When raw bytes exist, they are.
	if (parsed !== undefined && parsed !== null && !parsedIsEmptyObject) {
		return stableStringify(parsed);
	}

	if (request.rawBody === undefined || request.rawBody === null) {
		return stableStringify(parsed === undefined ? null : parsed);
	}

	const raw = Buffer.isBuffer(request.rawBody) ? request.rawBody.toString('utf8') : String(request.rawBody);

	if (raw.trim() === '') {
		return stableStringify(parsed === undefined ? null : parsed);
	}

	try {
		return stableStringify(JSON.parse(raw));
	} catch {
		// Not JSON — a signed blob, XML, or plain text. Its bytes are its meaning.
		return raw;
	}
}

/**
 * Hashes what makes two requests the same request.
 *
 * Method, path, query and body together — because the same key presented to the same scope for a
 * different body is not a retry, and answering it with the first response would answer a question
 * the caller never asked.
 *
 * Every one of the four is reduced to its canonical form first, which is the property the whole
 * mechanism rests on: two spellings of one request must produce one hash, or the retry is refused as
 * a reused key. The method is upper-cased, the path loses the query it may carry a second time, the
 * query is sorted, and the body is canonicalized by {@link canonicalizeBody} — which reads the
 * parsed body rather than the bytes, so a rebuilt retry is still a retry.
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
	const canonical = JSON.stringify([
		String(request.method ?? '').toUpperCase(),
		canonicalizePath(request.path),
		canonicalizeQuery(request.query),
		canonicalizeBody(request)
	]);

	return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Reads the key off a resolver's arguments.
 *
 * Both spellings a resolver may use are read: an `input` object that carries the member, and the
 * member taken as the resolver's own argument. The value is returned raw, because the caller decides
 * whether an absent key is a refusal or nothing to do with this route — the same decision the header
 * path makes.
 *
 * @param args The resolver's arguments, as Nest hands them over.
 * @returns The raw stated key, or undefined when none was stated.
 */
export function idempotencyKeyFromResolverArgs(args: any): unknown {
	if (args === null || typeof args !== 'object') {
		return undefined;
	}

	if (args.input !== null && typeof args.input === 'object' && IDEMPOTENCY_KEY_MEMBER in args.input) {
		return args.input[IDEMPOTENCY_KEY_MEMBER];
	}

	return IDEMPOTENCY_KEY_MEMBER in args ? args[IDEMPOTENCY_KEY_MEMBER] : undefined;
}

/**
 * Hashes what makes two GraphQL operations the same operation.
 *
 * The tuple is the GraphQL equivalent of the HTTP one: the root type, the field, and the arguments
 * with the retry key removed. The key is not part of the fingerprint on purpose — it is the record's
 * *identity*, not its content, so two different keys presented with the same input are two attempts
 * at one request rather than one key reused.
 *
 * @param request The operation fingerprint.
 * @returns The hex sha-256 of the canonicalized operation.
 */
export function buildGraphqlRequestHash(request: {
	operation?: string;
	fieldName?: string;
	args?: unknown;
}): string {
	const canonical = JSON.stringify([
		String(request.operation ?? 'mutation').toLowerCase(),
		request.fieldName ?? '',
		stableStringify(withoutIdempotencyKey(request.args) ?? {})
	]);

	return createHash('sha256').update(canonical).digest('hex');
}

/**
 * The same arguments with the retry key removed.
 *
 * Only the member itself is removed, and only at the top level of the input: an input that carries
 * a key for a *nested* concept is stating part of its content, and dropping that would make two
 * different requests look like one.
 *
 * @param args The resolver's arguments.
 * @returns The arguments without the retry key.
 */
function withoutIdempotencyKey(args: unknown): unknown {
	if (args === null || typeof args !== 'object' || Array.isArray(args)) {
		return args;
	}

	const record = { ...(args as Record<string, unknown>) };

	if (record.input !== null && typeof record.input === 'object' && !Array.isArray(record.input)) {
		const input = { ...(record.input as Record<string, unknown>) };
		delete input[IDEMPOTENCY_KEY_MEMBER];
		record.input = input;
	}

	delete record[IDEMPOTENCY_KEY_MEMBER];

	return record;
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
