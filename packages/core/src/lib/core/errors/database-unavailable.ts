import { HttpException } from '@nestjs/common';

/**
 * Telling "the database could not be reached" apart from every other failure.
 *
 * Why it matters: the JWT strategy turns ANY error thrown while it looks the caller up into a 401. When
 * the connection pool is saturated or the database restarts, that tells every client its perfectly
 * valid token is bad — clients drop it and refresh, the refreshes fail the same way, and the load that
 * caused the outage is multiplied by a storm of re-authentication. A request that could not be judged
 * because the database was unreachable has to be answered with a 503, which clients retry with the
 * token they have.
 *
 * Deliberately conservative: an error counts only when it is positively identified as a
 * connection, pool or timeout failure — by a SQLSTATE of the connection/availability classes, by the
 * exact wording of `pg` / `pg-pool` / knex, or by a socket-level system error. Anything else (a missing
 * row, a constraint, a bad parameter, an unknown error) is not an outage and keeps whatever handling it
 * had. An `HttpException` is never one: it is a decision somebody made, not a failure to reach anyone.
 *
 * Use it only where the work that failed is database work: a socket error from an HTTP client would
 * also match.
 */

/**
 * PostgreSQL SQLSTATEs that mean the server cannot serve the request right now, whatever was asked.
 *
 * - `53300` too_many_connections
 * - `57P01` admin_shutdown, `57P02` crash_shutdown, `57P03` cannot_connect_now (starting up / recovery)
 * - `57014` query_canceled — what `statement_timeout` raises; the lookups this is used for are
 *   primary-key reads, so it means the server is too slow to answer, not that the input was bad
 */
const UNAVAILABLE_SQLSTATES: ReadonlySet<string> = new Set(['53300', '57P01', '57P02', '57P03', '57014']);

/** SQLSTATE class 08 — connection_exception (08000, 08003, 08006, 08001, 08004, 08007, 08P01). */
const CONNECTION_EXCEPTION_CLASS = /^08[0-9A-Z]{3}$/;

/**
 * Node system error codes of a socket that could not be opened or was lost. Only counted on an error
 * that carries `syscall`, i.e. one the socket layer itself raised.
 */
const SOCKET_ERROR_CODES: ReadonlySet<string> = new Set([
	'ECONNREFUSED',
	'ECONNRESET',
	'ETIMEDOUT',
	'EPIPE',
	'EHOSTUNREACH',
	'ENETUNREACH',
	'EAI_AGAIN'
]);

/**
 * The exact messages the drivers raise when no connection is available. Anchored, so a hand-written
 * message that merely mentions a connection never matches. The `Connection terminated` family is
 * anchored at its end only: knex (MikroORM) prefixes a failed query's message with its SQL.
 */
const UNAVAILABLE_MESSAGES: ReadonlyArray<RegExp> = [
	// pg-pool: every pooled connection was busy for `connectionTimeoutMillis`
	/^timeout exceeded when trying to connect$/,
	// pg / pg-pool: the connection was lost, or never completed within `connectionTimeoutMillis`
	/(?:^|\s-\s)Connection terminated(?: unexpectedly| due to connection timeout)?$/,
	// pg: a query sent on a client whose connection already failed or was closed
	/^Client has encountered a connection error and is not queryable$/,
	/^Client was closed and is not queryable$/,
	// pg-pool: the pool is shutting down
	/^Cannot use a pool after calling end on the pool$/,
	// pg: `query_timeout` elapsed
	/^Query read timeout$/,
	// knex (MikroORM): every pooled connection was busy for `acquireConnectionTimeout`
	/^Knex: Timeout acquiring a connection\b/
];

/**
 * What a client is told when its request could not be judged because the database was unreachable.
 * Never the driver's own text, which names hosts, ports and pool internals.
 */
export const DATABASE_UNAVAILABLE_MESSAGE = 'The service is temporarily unavailable. Please try again shortly.';

/** How far down `driverError` / `cause` chains to look; the ORMs wrap at most twice. */
const MAX_DEPTH = 4;

/**
 * Whether a caught error means the database could not be reached (connection refused or lost, pool
 * exhausted, server shutting down or overloaded, timed out), as opposed to anything about the request.
 *
 * Looks through the wrappers the ORMs put around a driver error: TypeORM's `QueryFailedError.driverError`
 * and an `Error.cause` chain (pg-pool's own connection-timeout error carries the socket error as `cause`).
 *
 * @param error - The caught error.
 * @returns `true` only for an error positively identified as a connection, pool or timeout failure.
 */
export function isDatabaseUnavailableError(error: unknown): boolean {
	const seen = new Set<object>();
	let level: unknown[] = [error];

	for (let depth = 0; depth < MAX_DEPTH && level.length > 0; depth++) {
		const next: unknown[] = [];
		for (const candidate of level) {
			if (!candidate || typeof candidate !== 'object' || seen.has(candidate)) {
				continue;
			}
			seen.add(candidate);

			// A deliberate decision (401, 404, ...), whatever it may have been caused by.
			if (candidate instanceof HttpException) {
				continue;
			}
			if (isUnavailableSignal(candidate)) {
				return true;
			}
			const { driverError, cause } = candidate as { driverError?: unknown; cause?: unknown };
			next.push(driverError, cause);
		}
		level = next;
	}

	return false;
}

/**
 * Whether one error object, on its own, is a connection/pool/timeout failure.
 *
 * @param candidate - An error object (not its wrappers).
 */
function isUnavailableSignal(candidate: object): boolean {
	const { code, syscall, message } = candidate as { code?: unknown; syscall?: unknown; message?: unknown };

	if (typeof code === 'string') {
		if (UNAVAILABLE_SQLSTATES.has(code) || CONNECTION_EXCEPTION_CLASS.test(code)) {
			return true;
		}
		if (SOCKET_ERROR_CODES.has(code) && typeof syscall === 'string') {
			return true;
		}
	}

	return (
		candidate instanceof Error &&
		typeof message === 'string' &&
		UNAVAILABLE_MESSAGES.some((pattern) => pattern.test(message))
	);
}
