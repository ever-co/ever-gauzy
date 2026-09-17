import { ArgumentsHost, Catch, HttpException, HttpServer } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { RequestContext } from '../context/request-context';
import { toSafeHttpException } from '../interceptors/safe-http-exception';
import { ApiErrorCode } from './api-error-codes';
import { toApiErrorBody } from './api-error-body';
import { ApiException } from './api-exception';
import { describeDatabaseError, isDatabaseErrorPayload } from './database-error';
import { DatabaseErrorFilter } from './database-error.filter';
import { isHttpHost } from './execution-host';

/**
 * Renders the platform's error envelope, and delegates everything it does not own.
 *
 * Three paths, and the reason each one exists:
 *
 * 1. an {@link ApiException} becomes the envelope — `statusCode`, `error`, `message` plus `code`,
 *    `details`, `timestamp`, `path`, `traceId`;
 * 2. an `HttpException` whose payload exposes a database driver error becomes the envelope with
 *    `code: INTERNAL_ERROR` and the same scrubbed message the application already answers with —
 *    the payload is classified here, before it is rendered, because the driver's `query` and
 *    `parameters` must not be able to survive into a structured body;
 * 3. every other `HttpException` goes to the existing {@link DatabaseErrorFilter} — literally its
 *    own `catch`, not a copy of it. Its depth-6 fail-closed scrub, its redacted log line and its
 *    rule that a status is never rewritten are therefore still the behaviour, and the regression
 *    suite that already covers it covers this path too. The database path stays guarded even if
 *    this filter is reverted: the application still registers the database filter on its own.
 *
 * The HTTP status is never changed here. A failed write stays 400, a conflict stays 409, and a
 * database leak that arrived as a 400 is still a 400 — the envelope adds keys, never a status.
 *
 * Registration order: this filter must be registered AFTER `DatabaseErrorFilter`. Nest reverses
 * the global filter list before it selects the first match (`RouterExceptionFilters.create` →
 * `setCustomFilters(filters.reverse())`, then `selectExceptionFilterMetadata` → `Array.find`), so
 * the LAST globally registered filter is the FIRST one consulted. Registering this one first would
 * leave `DatabaseErrorFilter` — which also matches every `HttpException` — answering first, and the
 * envelope would never be rendered.
 */
@Catch(HttpException)
export class ApiExceptionFilter extends BaseExceptionFilter {
	/** The existing application-wide scrubbing filter, delegated to — never reimplemented. */
	private readonly database: DatabaseErrorFilter;

	/**
	 * @param applicationRef - The HTTP adapter. It must be supplied: `BaseExceptionFilter` resolves
	 * it through optional injection, which does not run for an instance constructed outside DI,
	 * and without it the reply cannot be written at all.
	 */
	constructor(applicationRef?: HttpServer) {
		super(applicationRef);
		// The delegate needs the adapter for its own `super.catch(...)` call.
		this.database = new DatabaseErrorFilter(applicationRef);
	}

	/**
	 * @param exception - Whatever escaped the route.
	 * @param host - The arguments host for the current context.
	 */
	catch(exception: unknown, host: ArgumentsHost): void {
		// This filter renders an HTTP reply, so it owns the HTTP surface only. A global filter is
		// consulted for every context, and a GraphQL request has no HTTP response to write to: the
		// host's response object there is the GraphQL context, `response.status` does not exist, and
		// reaching for it turns the caller's real error into `response.status is not a function` —
		// an error about the error handler, with the original failure lost behind it. Rethrowing
		// hands the exception to graphql-js, which reports it in the response's `errors` array, and
		// the Apollo `formatError` handler gives it the code and status the contract declares.
		if (isHttpHost(host) === false) {
			throw exception;
		}

		if (exception instanceof ApiException) {
			this.writeEnvelope(exception, host);
			return;
		}

		if (exception instanceof HttpException) {
			const driver = resolveDriverPayload(exception.getResponse());
			if (driver) {
				// Same message the existing filter produces; the envelope adds only the code and the
				// request identifiers.
				this.writeEnvelope(
					new ApiException(exception.getStatus(), ApiErrorCode.INTERNAL_ERROR, describeDatabaseError(driver)),
					host
				);
				return;
			}

			this.database.catch(exception, host);
			return;
		}

		// Unreachable while this filter is declared for `HttpException` — Nest routes only that
		// metatype here, and the response interceptor has already normalised anything else. It is
		// kept, rather than assumed, because the decorator is the only thing making it unreachable
		// and a widened decorator must not quietly turn a 5xx into an unhandled error.
		super.catch(toSafeHttpException(exception), host);
	}

	/**
	 * Writes the envelope through Nest's own reply path: the body is handed back as a plain
	 * `HttpException`, so status line, headers and serialization are whatever the framework does
	 * for every other error and nothing about the transport is reimplemented here.
	 *
	 * @param exception - The exception to render.
	 * @param host - The arguments host for the current context.
	 */
	private writeEnvelope(exception: ApiException, host: ArgumentsHost): void {
		const request = host.switchToHttp().getRequest();
		const body = toApiErrorBody(exception, request, RequestContext.currentTraceId());
		super.catch(new HttpException(body, exception.getStatus()), host);
	}
}

/**
 * The database driver error hiding in an exception payload, if there is one.
 *
 * Two shapes reach an HTTP error body. A handler that re-throws the caught ORM error puts the
 * driver object in the body itself — Nest serializes its enumerable properties, which are exactly
 * `query`, `parameters` and `driverError`. A handler that re-throws `error.message` puts the
 * driver's text in `message` instead, and that case is deliberately NOT claimed here: it carries no
 * structured payload to classify, so it takes the delegation path and keeps today's bytes.
 *
 * Exported because the GraphQL surface classifies the same payload with it. One implementation is
 * what makes "the same failure carries the same code on both surfaces" a property rather than a
 * coincidence.
 *
 * @param payload - The exception's response payload.
 */
export function resolveDriverPayload(payload: unknown): unknown {
	if (isDatabaseErrorPayload(payload)) {
		return payload;
	}
	const message = (payload as { message?: unknown } | null | undefined)?.message;
	return isDatabaseErrorPayload(message) ? message : undefined;
}
