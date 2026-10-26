/**
 * Telling a lost insert race apart from a real write failure.
 *
 * The kernel uses inserts as locks in three places — claiming an idempotency key, writing an event
 * into the outbox partition, and claiming an aggregate for an operation. In all three, a unique
 * violation is the *expected* answer for the request that lost the race, and every other database
 * error is a genuine failure that must surface. That distinction has to be made against the driver
 * error, because TypeORM wraps it in a `QueryFailedError` whose own message is generic.
 *
 * The codes are the same set the error filter already translates (`database-error.ts`): Postgres
 * SQLSTATE, MySQL `ER_*`, SQLite `SQLITE_CONSTRAINT_*`. The message forms are matched as well,
 * because a MikroORM `DriverException` and a raw driver error do not always carry `code`.
 */

/** Driver codes that mean "this row already exists". */
const UNIQUE_VIOLATION_CODES: ReadonlyArray<string> = [
	'23505', // postgres: unique_violation
	'ER_DUP_ENTRY', // mysql / mariadb
	'SQLITE_CONSTRAINT_UNIQUE', // sqlite / better-sqlite3
	'SQLITE_CONSTRAINT_PRIMARYKEY'
];

/** Driver phrasings of the same condition, for errors that arrive without a code. */
const UNIQUE_VIOLATION_MESSAGES: ReadonlyArray<RegExp> = [
	/duplicate key value violates unique constraint/i,
	/duplicate entry .* for key/i,
	/unique constraint failed/i
];

/**
 * Reads the driver code off an error, wherever the driver put it.
 *
 * `code` sits on the error itself for Postgres and SQLite, on `driverError` once TypeORM has wrapped
 * it, and on `errno`-adjacent fields for some MySQL drivers.
 *
 * @param error - The caught error.
 * @returns The driver code, or undefined when there is none.
 */
function resolveDriverCode(error: unknown): string | undefined {
	if (!error || typeof error !== 'object') {
		return undefined;
	}

	const candidate = error as { code?: unknown; driverError?: { code?: unknown } };
	const code = candidate.code ?? candidate.driverError?.code;

	return typeof code === 'string' ? code : undefined;
}

/**
 * Whether an error is a unique-constraint violation.
 *
 * @param error - The caught error.
 * @returns True when a row with the same unique tuple already exists.
 */
export function isUniqueViolation(error: unknown): boolean {
	const code = resolveDriverCode(error);

	if (code && UNIQUE_VIOLATION_CODES.includes(code)) {
		return true;
	}

	const message =
		error instanceof Error
			? error.message
			: error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
			? ((error as { message: string }).message as string)
			: undefined;

	return !!message && UNIQUE_VIOLATION_MESSAGES.some((pattern) => pattern.test(message));
}
