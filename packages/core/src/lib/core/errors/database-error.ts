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

/** Property names that only ever appear on a driver/ORM error payload. */
const DATABASE_ERROR_KEYS = ['query', 'parameters', 'driverError', 'sql', 'sqlMessage', 'parameter'] as const;

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
	// Anything still carrying raw SQL or a driver code is replaced wholesale.
	[/\b(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)\b\s+["'`\w]/i, GENERIC_DATABASE_ERROR_MESSAGE],
	[/\bSQLITE_[A-Z_]+\b/, GENERIC_DATABASE_ERROR_MESSAGE],
	[/\bER_[A-Z_]+\b/, GENERIC_DATABASE_ERROR_MESSAGE],
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
	return DATABASE_ERROR_KEYS.some((key) => key in (value as Record<string, unknown>));
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
