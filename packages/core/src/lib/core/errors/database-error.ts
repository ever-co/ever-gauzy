/**
 * Keeping database internals out of HTTP responses.
 *
 * `throw new BadRequestException(error)` with a caught TypeORM error looks harmless, but Nest puts
 * the object straight into the response body, and `JSON.stringify` of a `QueryFailedError` emits its
 * ENUMERABLE own properties — which are exactly `query`, `parameters` and `driverError`. (`message`
 * and `name` live on `Error.prototype` and are non-enumerable, so the one part that would have been
 * safe to show is the part that gets dropped.)
 *
 * The observed shape, from `PUT /api/goals/<unknown-uuid>` on a local API:
 *
 * ```json
 * { "query": "INSERT INTO \"goal\"(\"deletedAt\", \"createdAt\", ...) VALUES (?, ?, ...)",
 *   "parameters": ["...", "..."], "driverError": {} }
 * ```
 *
 * That hands any caller who can trip a constraint the statement text and every bound value — which
 * can include other users' data echoed back from the payload, and the exact column layout.
 */

/**
 * Property names that only ever appear on a driver/ORM error payload.
 *
 * `parameter` is deliberately NOT here: unlike `parameters`, it is an ordinary English word that a
 * legitimate response body may carry, and this list decides whether a body is replaced WHOLESALE.
 */
const DATABASE_ERROR_KEYS = ['driverError', 'sqlMessage'] as const;

/**
 * Keys that indicate a driver error only in combination — `query` alone is too generic a name to
 * condemn a whole response body on, but a non-empty `query` string next to `parameters` is not
 * something an ordinary handler produces.
 */
const DATABASE_ERROR_COMBO_KEYS = ['query', 'sql'] as const;

/** What the client is told instead, when nothing more specific is known. */
export const GENERIC_DATABASE_ERROR_MESSAGE = 'The request could not be completed.';

/**
 * Driver error codes worth translating, so the UI keeps useful feedback instead of one opaque
 * string. Postgres uses SQLSTATE, MySQL uses `ER_*`, SQLite uses `SQLITE_CONSTRAINT_*`.
 */
const DATABASE_ERROR_MESSAGES: ReadonlyMap<string, string> = new Map([
	// unique violation
	['23505', 'A record with these values already exists.'],
	['ER_DUP_ENTRY', 'A record with these values already exists.'],
	['SQLITE_CONSTRAINT_UNIQUE', 'A record with these values already exists.'],
	['SQLITE_CONSTRAINT_PRIMARYKEY', 'A record with these values already exists.'],
	// foreign key violation
	['23503', 'A related record referenced by this request does not exist.'],
	['ER_NO_REFERENCED_ROW_2', 'A related record referenced by this request does not exist.'],
	['SQLITE_CONSTRAINT_FOREIGNKEY', 'A related record referenced by this request does not exist.'],
	// not null violation
	['23502', 'A required field is missing.'],
	['ER_BAD_NULL_ERROR', 'A required field is missing.'],
	['SQLITE_CONSTRAINT_NOTNULL', 'A required field is missing.'],
	// check constraint
	['23514', 'A value in this request is not allowed.'],
	['SQLITE_CONSTRAINT_CHECK', 'A value in this request is not allowed.'],
	// malformed input (e.g. a non-uuid where a uuid column is expected)
	['22P02', 'A value in this request has the wrong format.'],
	['ER_TRUNCATED_WRONG_VALUE', 'A value in this request has the wrong format.']
]);

/**
 * Driver MESSAGE signatures, for the second way this leaks.
 *
 * ~160 call sites throw `new BadRequestException(error.message)` (or interpolate it into a
 * template). That produces a plain string, so the shape check below cannot see it — but on a
 * database error that string is the DRIVER's own message, which names tables, columns and
 * constraints, and on MySQL embeds the offending value outright:
 *
 * - postgres: `duplicate key value violates unique constraint "user_email_key"`
 * - postgres: `null value in column "name" of relation "goal" violates not-null constraint`
 * - mysql:    `Duplicate entry 'alice@example.com' for key 'user.email'`
 * - sqlite:   `SQLITE_CONSTRAINT_UNIQUE: UNIQUE constraint failed: user.email`
 *
 * Only unambiguous driver phrasing is matched, so a hand-written message is never rewritten.
 */
const DATABASE_MESSAGE_SIGNATURES: ReadonlyArray<[RegExp, string]> = [
	[/duplicate key value violates unique constraint/i, 'A record with these values already exists.'],
	[/duplicate entry .* for key/i, 'A record with these values already exists.'],
	[/UNIQUE constraint failed/i, 'A record with these values already exists.'],
	[/violates foreign key constraint/i, 'A related record referenced by this request does not exist.'],
	[/FOREIGN KEY constraint failed/i, 'A related record referenced by this request does not exist.'],
	[/cannot add or update a child row/i, 'A related record referenced by this request does not exist.'],
	[/violates not-null constraint/i, 'A required field is missing.'],
	[/NOT NULL constraint failed/i, 'A required field is missing.'],
	// MySQL's exact phrasing — deliberately not a bare /cannot be null/, which would also rewrite a
	// hand-written "Organization cannot be null".
	[/column '[^']*' cannot be null/i, 'A required field is missing.'],
	[/violates check constraint/i, 'A value in this request is not allowed.'],
	[/CHECK constraint failed/i, 'A value in this request is not allowed.'],
	[/invalid input syntax for/i, 'A value in this request has the wrong format.'],
	// value/length overflows — postgres, mysql
	[/value too long for type/i, 'A value in this request is too long.'],
	[/data too long for column/i, 'A value in this request is too long.'],
	[/out of range value for column/i, 'A value in this request is out of range.'],
	[/numeric field overflow/i, 'A value in this request is out of range.'],
	// Anything still carrying a raw statement or a driver code is replaced wholesale.
	//
	// CASE-SENSITIVE, and it must look like an actual statement. The earlier version of this pattern
	// was `/\b(SELECT|INSERT INTO|UPDATE|DELETE FROM)\b\s+["'`\w]/i`, and measured against the 382
	// distinct hand-written exception messages in this repo it rewrote FOURTEEN of them — including
	// "Please select valid Date, start time and end time", "Failed to update the password" and
	// "Update data is required". Drivers emit SQL keywords in upper case; English prose does not.
	[/\b(?:SELECT\s+[\s\S]+\s+FROM|INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM)\s+["'`\w]/, GENERIC_DATABASE_ERROR_MESSAGE],
	[/\bSQLITE_[A-Z_]+\b/, GENERIC_DATABASE_ERROR_MESSAGE],
	[/\bER_[A-Z_]{3,}\b/, GENERIC_DATABASE_ERROR_MESSAGE],
	[/\bQueryFailedError\b/, GENERIC_DATABASE_ERROR_MESSAGE]
];

/**
 * Whether a message string is a database driver's own text rather than something a developer wrote.
 *
 * @param value - The candidate message.
 * @returns The safe replacement when the text is driver output, otherwise undefined.
 */
export function safeMessageForDatabaseText(value: unknown): string | undefined {
	if (typeof value !== 'string' || !value) {
		return undefined;
	}
	const match = DATABASE_MESSAGE_SIGNATURES.find(([pattern]) => pattern.test(value));
	return match?.[1];
}

/**
 * Whether a value carries database internals that must never reach a client.
 *
 * Deliberately shape-based rather than `instanceof QueryFailedError`: the same properties arrive
 * from MikroORM's `DriverException`, from raw driver errors, and from an error that has already
 * been spread into a plain object somewhere up the stack.
 *
 * @param value - Any caught error or response payload.
 * @returns True when the value exposes query text, bound parameters or a driver error.
 */
export function isDatabaseErrorPayload(value: unknown): boolean {
	if (!value || typeof value !== 'object') {
		return false;
	}

	// OWN properties only. `key in obj` walks the prototype chain, so an object inheriting a getter
	// named `query` — or anything built from a class with such a member — would be condemned.
	const has = (key: string) => Object.prototype.hasOwnProperty.call(value, key);

	// Unambiguous on its own: nothing but a driver puts these on an object.
	if (DATABASE_ERROR_KEYS.some(has)) {
		return true;
	}

	// Ambiguous alone, conclusive together: a non-empty statement string next to bound parameters.
	const record = value as Record<string, unknown>;
	if (DATABASE_ERROR_COMBO_KEYS.some((key) => has(key) && typeof record[key] === 'string' && record[key])) {
		if (has('parameters') || typeof resolveDriverCode(value) === 'string') {
			return true;
		}
	}

	// A bare driver error — `{ code, message }` with a code we recognise and no other structure —
	// still has to be caught, or it is serialized straight into the response.
	const code = resolveDriverCode(value);
	return !!code && DATABASE_ERROR_MESSAGES.has(code);
}

/**
 * Extracts a driver error code from wherever the ORM happened to put it.
 *
 * @param error - The caught error.
 * @returns The driver code, when one is present.
 */
function resolveDriverCode(error: unknown): string | undefined {
	if (!error || typeof error !== 'object') {
		return undefined;
	}
	const candidate = error as { code?: unknown; driverError?: { code?: unknown }; errno?: unknown };
	const code = candidate.code ?? candidate.driverError?.code;
	return typeof code === 'string' ? code : undefined;
}

/**
 * The client-safe message for a database error: specific where the driver code is recognised,
 * generic otherwise. Never derived from the driver's own message text, which embeds column names,
 * constraint names and sometimes the offending value.
 *
 * @param error - The caught error.
 * @returns A message that is safe to return to the caller.
 */
export function describeDatabaseError(error: unknown): string {
	const code = resolveDriverCode(error);
	return (code && DATABASE_ERROR_MESSAGES.get(code)) || GENERIC_DATABASE_ERROR_MESSAGE;
}

/**
 * The message to show for a caught error, safe in both directions.
 *
 * A database error is described by its driver code; anything else keeps its own message, because
 * flattening every failure to one generic string would throw away the useful half — a missing
 * record and a constraint violation are not the same thing to the caller.
 *
 * @param error - The caught error.
 * @returns A message that is safe to return to the caller.
 */
export function safeErrorMessage(error: unknown): string {
	if (isDatabaseErrorPayload(error)) {
		return describeDatabaseError(error);
	}
	const message = (error as Error)?.message;
	// A non-database error can still be carrying driver text (a service that re-threw `error.message`).
	return safeMessageForDatabaseText(message) ?? message ?? GENERIC_DATABASE_ERROR_MESSAGE;
}

/**
 * A view of a caught error that is safe to write to the application log.
 *
 * The response is sanitized, but stdout usually ships to a retained log store, and a
 * `QueryFailedError`'s `parameters` holds the values the caller submitted — emails, names, tokens.
 * Everything that helps diagnose the failure is kept (statement text, driver code, driver message);
 * only the bound values are dropped, replaced by their count so the shape is still visible.
 *
 * @param error - The caught error.
 * @returns A value suitable for logging.
 */
export function redactDatabaseError(error: unknown): unknown {
	if (!isDatabaseErrorPayload(error)) {
		return error;
	}

	const source = error as Record<string, unknown>;
	const redacted: Record<string, unknown> = {
		name: (error as Error)?.name,
		message: (error as Error)?.message,
		code: resolveDriverCode(error)
	};

	if ('query' in source) redacted['query'] = source['query'];
	if ('parameters' in source) {
		redacted['parameters'] = `[redacted: ${Array.isArray(source['parameters']) ? source['parameters'].length : 'n/a'} bound values]`;
	}

	return redacted;
}

/**
 * Produces the value to hand to an `HttpException` for a caught error.
 *
 * Non-database errors are passed through untouched — a `BadRequestException` raised deliberately
 * with a message, and class-validator's array of constraint messages, both have to keep working.
 * Only payloads carrying database internals are replaced.
 *
 * @param error - The caught error.
 * @returns Either the original value, or a safe message string replacing it.
 */
export function toClientSafeError(error: unknown): unknown {
	if (isDatabaseErrorPayload(error)) {
		return describeDatabaseError(error);
	}
	return error;
}
