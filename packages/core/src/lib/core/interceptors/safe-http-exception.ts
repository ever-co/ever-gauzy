import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';

/**
 * Body keys that never belong in an HTTP response: driver / transport internals that carry SQL
 * text, bound parameters, request headers (bearer tokens) or stack traces.
 */
const UNSAFE_BODY_KEYS = new Set([
	'stack',
	'query',
	'parameters',
	'driverError',
	'config',
	'request',
	'response',
	'sql',
	'cause'
]);

/** How deep {@link sanitizeErrorBody} walks nested objects before it stops copying. */
const MAX_DEPTH = 4;

/**
 * Turns whatever escaped a controller into the `HttpException` the response should carry —
 * ONE rule for every interceptor that catches errors:
 *
 * - `BadRequestException` → re-issued with its own body (validation arrays intact);
 * - any other `HttpException` → its body is kept STRUCTURED (clients branch on `code`, …) but
 *   passed through {@link sanitizeErrorBody}: many throw sites do
 *   `new HttpException({ message, error }, 400)` with the raw caught error object in `error`, and
 *   a TypeORM `QueryFailedError` / Axios error serialises with the SQL statement, the bound
 *   parameters, the driver fields or the request headers — none of which may leave the server;
 * - a non-HTTP error (TypeORM, a plain `Error`, a thrown object) → `500` (or its own numeric
 *   4xx/5xx `status`). It must NOT become `new HttpException(message, undefined)`: with an
 *   undefined status Express kept the default **200** and clients received `{ message }` as a
 *   successful response.
 */
export function toSafeHttpException(error: unknown): HttpException {
	if (error instanceof BadRequestException) {
		const response = error.getResponse();
		if (typeof response !== 'object' || response === null) {
			return error;
		}
		// This branch used to return the body VERBATIM, to keep class-validator's `message: [...]`
		// array intact. But `CrudService` throws `new BadRequestException(queryFailedError)` — also a
		// BadRequestException — so every failed database write skipped the scrub below and answered
		// with the driver's `query`, `parameters` and `driverError`. `sanitizeErrorBody` preserves
		// arrays, so the validation contract survives the sanitization it was carved out of.
		return new BadRequestException(sanitizeErrorBody(response) as Record<string, unknown>);
	}
	if (error instanceof HttpException) {
		const response = error.getResponse();
		if (typeof response !== 'object' || response === null) {
			return error;
		}
		const safe = sanitizeErrorBody(response) as Record<string, unknown>;
		// Nothing to scrub (the common case) → the ORIGINAL instance, subclass and all.
		if (JSON.stringify(safe) === JSON.stringify(response)) {
			return error;
		}
		return new HttpException(safe, error.getStatus());
	}
	const candidate = (error as { status?: unknown; message?: unknown } | null | undefined)?.status;
	const status = isHttpErrorStatus(candidate) ? candidate : HttpStatus.INTERNAL_SERVER_ERROR;
	const message = (error as { message?: unknown } | null | undefined)?.message;
	return new HttpException(typeof message === 'string' && message ? message : 'Internal server error', status);
}

/**
 * A JSON-safe copy of an error body: `Error` instances collapse to their message, the
 * transport/driver internals in {@link UNSAFE_BODY_KEYS} are dropped, arrays and plain objects are
 * walked (bounded depth), everything else passes through.
 */
export function sanitizeErrorBody(value: unknown, depth = 0): unknown {
	if (value === null || value === undefined) {
		return value;
	}
	if (value instanceof Error) {
		return value.message;
	}
	if (typeof value !== 'object') {
		return value;
	}
	if (depth >= MAX_DEPTH) {
		return undefined;
	}
	if (Array.isArray(value)) {
		return value.map((item) => sanitizeErrorBody(item, depth + 1));
	}
	const copy: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
		if (UNSAFE_BODY_KEYS.has(key)) {
			continue;
		}
		const safe = sanitizeErrorBody(item, depth + 1);
		if (safe !== undefined) {
			copy[key] = safe;
		}
	}
	return copy;
}

/** Only a real HTTP error status may reach `res.status()` — a stray `status: 1` (a child-process exit code) must not. */
function isHttpErrorStatus(value: unknown): value is number {
	return Number.isInteger(value) && (value as number) >= 400 && (value as number) <= 599;
}
