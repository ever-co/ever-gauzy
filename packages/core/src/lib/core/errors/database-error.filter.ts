import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import {
	describeDatabaseError,
	isDatabaseErrorPayload,
	redactDatabaseError,
	safeMessageForDatabaseText
} from './database-error';

/**
 * Keeps database internals out of HTTP responses.
 *
 * ~120 sites across the API re-throw a caught ORM error as `new BadRequestException(error)`, and
 * Nest serializes that object's ENUMERABLE properties — which on a TypeORM `QueryFailedError` are
 * exactly `query`, `parameters` and `driverError`. A further ~160 throw `error.message`, which is
 * the driver's own text and names tables, columns and constraints (and on MySQL, the offending
 * value). Fixing those one at a time leaves the next one to be written unguarded, so the guarantee
 * is enforced here as well, at the single point every HTTP error passes through.
 *
 * Everything that is not a database leak is delegated to {@link BaseExceptionFilter} — Nest's own
 * handler — rather than reimplemented, so response shapes stay byte-for-byte identical. That
 * matters more than it looks: `new HttpException('msg', 404).getResponse()` returns a bare string,
 * which Nest wraps as `{ statusCode, message }`, while `new BadRequestException('msg')` already
 * returns the full object. Replicating that by hand is how a filter quietly changes every error
 * response in the app.
 *
 * Only `HttpException` is caught. A raw error that never got wrapped still reaches Nest's default
 * handling and answers 500 `{"message":"Internal server error"}`, which leaks nothing.
 *
 * Status codes are never changed: a failed write stays 400, a conflict stays 409.
 */
@Catch(HttpException)
export class DatabaseErrorFilter extends BaseExceptionFilter {
	/** How deep the nested-payload scrub walks before giving up (driver errors can hold cycles). */
	private static readonly MAX_SANITIZE_DEPTH = 6;

	private readonly logger = new Logger(DatabaseErrorFilter.name);

	/**
	 * @param exception - The thrown HTTP exception.
	 * @param host - The arguments host for the current context.
	 */
	catch(exception: HttpException, host: ArgumentsHost): void {
		const payload = exception.getResponse();
		const safeMessage = this.resolveSafeMessage(payload);

		if (!safeMessage) {
			// Not a database leak — hand it to Nest's own handler untouched.
			super.catch(exception, host);
			return;
		}

		const status = exception.getStatus();
		const request = host.switchToHttp().getRequest();

		// Log the error itself, not `exception.stack`. The stack belongs to the HttpException that
		// WRAPPED the driver error and points at the throw site — it carries none of the driver's
		// message, code or constraint, which is the part worth having. `redactDatabaseError` keeps all
		// of that and drops only the bound values (caller-submitted emails, names, tokens), since logs
		// are usually shipped to a retained store.
		//
		// Nothing here may throw: a driver payload can hold a circular reference back to the
		// connection, and an exception raised inside an exception filter aborts the response.
		this.logger.error(
			`Database error on ${request?.method ?? ''} ${request?.url ?? ''}`,
			this.describeForLog(payload) ?? exception.stack
		);

		// Rebuild the body around the safe message.
		//
		// The payload may only be SPREAD when it is an ordinary response body that merely happens to
		// carry driver text in `message`. When the payload IS the driver error, spreading it would
		// keep `query`/`parameters`/`driverError` and just add a polite message next to them — which
		// is the whole bug, restated. Those are replaced outright.
		const isDriverErrorItself = isDatabaseErrorPayload(payload);
		const body =
			!isDriverErrorItself && payload && typeof payload === 'object'
				? {
						...(this.withoutNestedDatabaseFields(payload) as Record<string, unknown>),
						message: safeMessage
					}
				: {
						statusCode: status,
						message: safeMessage,
						// Keep the reason phrase only if the original body actually had one.
						...(typeof (payload as { error?: unknown })?.error === 'string'
							? { error: (payload as { error: string }).error }
							: {})
					};

		super.catch(new HttpException(body, status), host);
	}

	/**
	 * Drops any nested value that is itself a driver error, at ANY depth.
	 *
	 * The spread branch preserves the caller's own body structure, but a handler that throws
	 * `{ message: error?.message, error }` puts the whole driver object one level down — and
	 * `{ error: { cause: queryFailure } }` puts it two down. Removing only direct children left
	 * `error.cause.query` and its bound parameters in the response.
	 *
	 * Depth is bounded and visited objects are tracked, because a driver error can hold a reference
	 * back to the connection: an unbounded walk would recurse forever inside an exception filter.
	 *
	 * @param value - The value being rebuilt.
	 * @param seen - Objects already visited on this path (cycle guard).
	 * @param depth - Current depth.
	 */
	private withoutNestedDatabaseFields(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
		if (!value || typeof value !== 'object') {
			return value;
		}
		// Fail CLOSED at the limit. Returning the subtree unexamined would hand back exactly the
		// `query`/`parameters` this walk exists to remove, for any payload that buries the driver
		// error deeper than the bound.
		if (depth > DatabaseErrorFilter.MAX_SANITIZE_DEPTH) {
			return undefined;
		}
		if (seen.has(value as object)) {
			return undefined;
		}
		seen.add(value as object);

		if (Array.isArray(value)) {
			return value
				.filter((item) => !isDatabaseErrorPayload(item))
				.map((item) => this.withoutNestedDatabaseFields(item, seen, depth + 1));
		}

		const cleaned: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
			if (isDatabaseErrorPayload(item)) {
				continue;
			}
			cleaned[key] = this.withoutNestedDatabaseFields(item, seen, depth + 1);
		}
		return cleaned;
	}

	/**
	 * A loggable description of the payload that cannot throw.
	 *
	 * @param payload - The exception's response payload.
	 */
	private describeForLog(payload: unknown): string | undefined {
		try {
			return JSON.stringify(this.redactForLog(payload));
		} catch {
			// Circular reference (a driver error can hold the connection) — the stack is the fallback.
			return undefined;
		}
	}

	/**
	 * Recursively redacts a payload for logging.
	 *
	 * `redactDatabaseError` only handles the case where the payload IS the driver error. A driver
	 * error arriving as a message STRING, or wrapped one or more levels down, would otherwise be
	 * written to the log with its bound values intact — and logs are usually retained far longer
	 * than a response.
	 *
	 * @param value - The value being logged.
	 * @param seen - Objects already visited (cycle guard).
	 * @param depth - Current depth.
	 */
	private redactForLog(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
		if (isDatabaseErrorPayload(value)) {
			return redactDatabaseError(value);
		}
		if (typeof value === 'string') {
			// Driver text arriving as a plain message still names constraints and, on MySQL, values.
			return safeMessageForDatabaseText(value) ?? value;
		}
		if (!value || typeof value !== 'object') {
			return value;
		}
		// Same reasoning as the response walk: past the bound, drop rather than copy.
		if (depth > DatabaseErrorFilter.MAX_SANITIZE_DEPTH) {
			return '[depth-limited]';
		}
		if (seen.has(value as object)) {
			return '[circular]';
		}
		seen.add(value as object);

		if (Array.isArray(value)) {
			return value.map((item) => this.redactForLog(item, seen, depth + 1));
		}

		const redacted: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
			redacted[key] = this.redactForLog(item, seen, depth + 1);
		}
		return redacted;
	}

	/**
	 * The replacement message when the payload exposes the database, or undefined to leave it alone.
	 *
	 * @param payload - The exception's response payload.
	 */
	private resolveSafeMessage(payload: unknown): string | undefined {
		// Shape 1: the driver error object itself (`query` / `parameters` / `driverError`).
		if (isDatabaseErrorPayload(payload)) {
			return describeDatabaseError(payload);
		}

		// Shape 2: a plain string, from the sites that throw `error.message`.
		if (typeof payload === 'string') {
			return safeMessageForDatabaseText(payload);
		}

		// Shape 3: a normal Nest body whose `message` is the driver's text.
		if (payload && typeof payload === 'object') {
			const { message } = payload as { message?: unknown };
			if (isDatabaseErrorPayload(message)) {
				return describeDatabaseError(message);
			}
			return safeMessageForDatabaseText(message);
		}

		return undefined;
	}
}
