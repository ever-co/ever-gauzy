/**
 * Telling a write the database refused because of a foreign key apart from any other failure.
 *
 * A delete the store refuses because other rows still point at the row is a conflict the caller can act on, not a
 * missing record. The CRUD base answers every failed delete with a 404 and keeps the driver's error as the
 * exception's `cause`, so a route that knows better reads that cause with this.
 *
 * The codes are the drivers' own: Postgres SQLSTATE, MySQL `ER_*`, SQLite `SQLITE_CONSTRAINT_*`. The message forms
 * are matched as well, because a MikroORM `DriverException` and a raw driver error do not always carry `code`.
 */

/** Driver codes of a foreign key violation, on a delete (a row still referenced) or a write (a missing parent). */
const FOREIGN_KEY_VIOLATION_CODES: ReadonlyArray<string> = [
	'23503', // postgres: foreign_key_violation
	'ER_ROW_IS_REFERENCED', // mysql: a parent row still referenced
	'ER_ROW_IS_REFERENCED_2',
	'ER_NO_REFERENCED_ROW', // mysql: a missing parent row
	'ER_NO_REFERENCED_ROW_2',
	'SQLITE_CONSTRAINT_FOREIGNKEY' // sqlite / better-sqlite3
];

/** Driver phrasings of the same condition, for errors that arrive without a code. */
const FOREIGN_KEY_VIOLATION_MESSAGES: ReadonlyArray<RegExp> = [
	/violates foreign key constraint/i,
	/cannot delete or update a parent row/i,
	/cannot add or update a child row/i,
	/FOREIGN KEY constraint failed/i
];

/**
 * Reads the driver code off an error, wherever the driver or the ORM put it.
 *
 * @param error - The caught error.
 * @returns The driver code, or undefined when there is none.
 */
function resolveDriverCode(error: object): string | undefined {
	const candidate = error as { code?: unknown; driverError?: { code?: unknown } };
	const code = candidate.code ?? candidate.driverError?.code;

	return typeof code === 'string' ? code : undefined;
}

/**
 * Whether an error is a foreign-key violation.
 *
 * @param error - The caught error (a driver error, a TypeORM `QueryFailedError` or a MikroORM `DriverException`).
 * @returns True when the database refused the write because of a foreign key.
 */
export function isForeignKeyViolation(error: unknown): boolean {
	if (!error || typeof error !== 'object') {
		return false;
	}

	const code = resolveDriverCode(error);
	if (code && FOREIGN_KEY_VIOLATION_CODES.includes(code)) {
		return true;
	}

	const message = (error as { message?: unknown }).message;
	if (typeof message !== 'string') {
		return false;
	}

	return FOREIGN_KEY_VIOLATION_MESSAGES.some((pattern) => pattern.test(message));
}
