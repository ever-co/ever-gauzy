import { Catch, HttpException } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { RequestContext } from '../../core/context/request-context';
import { ApiErrorCode, DEFAULT_CODE_BY_STATUS } from '../../core/errors/api-error-codes';
import { ApiException } from '../../core/errors/api-exception';
import { resolveDriverPayload } from '../../core/errors/api-exception.filter';
import { describeDatabaseError, isDatabaseErrorPayload, safeMessageForDatabaseText } from '../../core/errors/database-error';
import { toSafeHttpException } from '../../core/interceptors/safe-http-exception';

/**
 * Gives a GraphQL error the code its REST counterpart carries.
 *
 * There is one API surface, so a failure has one code whichever surface reported it, and a client
 * that switches its retry or its message lookup on `extensions.code` does not need a second table.
 * The code is the exception's own when it has one (an {@link ApiException} thrown by a resolver or
 * by the service underneath it), and the status's default otherwise — the same default the HTTP
 * envelope uses, from the same map.
 *
 * The status travels in `extensions.status`, not in the HTTP status of the response: an operation
 * that executed and produced errors still answers `200`, and a transport-level status could only
 * report one of the failures in a multi-error response anyway. `extensions.details` is present only
 * when the exception carried it, so a client can tell "no structured context" from "empty context".
 *
 * Nothing else is added. `toSafeHttpException` and the database classification below are the same
 * two gates the HTTP error path runs, so no stack, no SQL, no bound parameter and no driver text
 * reaches the `errors` array — a resolver that throws a raw ORM error is reported as a 5xx with the
 * generic database message, exactly as the REST path reports it.
 *
 * Registration: either `@UseFilters(GraphqlExceptionFilter)` on a resolver, or as the driver's
 * `formatError` handler. Both call `catch`.
 */
@Catch()
export class GraphqlExceptionFilter implements GqlExceptionFilter {
	/**
	 * @param exception - Whatever the resolver threw.
	 * @returns The error the response's `errors` array carries.
	 */
	catch(exception: unknown): GraphQLError {
		// The existing helper, unchanged: it decides the status and normalises everything that is
		// not already an HttpException.
		const http = toSafeHttpException(exception);
		const api = exception instanceof ApiException ? exception : undefined;
		// The same classification the HTTP envelope runs, so a driver payload cannot be a 409 with a
		// described message over REST and a 400 VALIDATION_FAILED here.
		const driver = api ? undefined : resolveDriverPayload(exception instanceof HttpException ? exception.getResponse() : exception);
		const traceId = RequestContext.currentTraceId();

		return new GraphQLError(driver ? describeDatabaseError(driver) : safeMessageFor(exception, http), {
			extensions: {
				code:
					api?.code ??
					(driver ? ApiErrorCode.INTERNAL_ERROR : DEFAULT_CODE_BY_STATUS[http.getStatus()]) ??
					ApiErrorCode.INTERNAL_ERROR,
				status: http.getStatus(),
				...(api?.details ? { details: api.details } : {}),
				// Omitted rather than sent as null when no request context exists, so a client never
				// has to distinguish "no trace" from "trace is empty".
				...(traceId ? { traceId } : {})
			}
		});
	}
}

/**
 * The message a GraphQL error may carry.
 *
 * `toSafeHttpException` keeps a non-HTTP error's own `message`, which for an ORM failure is the
 * driver's text — it names tables, columns and constraints, and on MySQL it can name the offending
 * value. The HTTP path answers that case with a described database error instead, so the same
 * classification is applied here; anything that is not driver-shaped is passed through untouched.
 *
 * @param exception - The error as thrown.
 * @param http - Its normalised HTTP form.
 */
function safeMessageFor(exception: unknown, http: HttpException): string {
	if (isDatabaseErrorPayload(exception)) {
		return describeDatabaseError(exception);
	}
	return safeMessageForDatabaseText(http.message) ?? http.message;
}
