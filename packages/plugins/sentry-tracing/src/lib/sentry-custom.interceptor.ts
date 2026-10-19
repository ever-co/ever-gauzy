import { CallHandler, ExecutionContext } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Observable, catchError, throwError } from 'rxjs';
import { RequestContext } from '@gauzy/core';
import { SentryInterceptor } from './ntegral';

/**
 * Whether the current tenant turned Sentry reporting off (`sentryEnabled` in its resolved settings), read the
 * way `SentryService.isEnabled` reads it. Without the setting, reporting follows the configured DSN.
 */
export function isSentryReportingDisabledForRequest(): boolean {
	try {
		const enabled = RequestContext.currentRequest()?.['resolvedSettings']?.sentryEnabled;
		return enabled !== undefined && !(enabled === true || enabled === 'true');
	} catch {
		// No request context
		return false;
	}
}

export class SentryCustomInterceptor extends SentryInterceptor {
	constructor() {
		super({
			filters: [
				/* For now let's report all, but later we can filter
				{
					type: HttpException,
					filter: (e: HttpException) => e.getStatus() < 500
				},
				{
					type: EntityNotFoundError
				}
				*/
			]
		});
	}

	/**
	 * Intercepts the execution context and handles errors.
	 * @param {ExecutionContext} context - The execution context.
	 * @param {CallHandler} next - The call handler.
	 * @returns {Observable<any>} An observable that represents the result of the intercepted operation.
	 */
	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		return next.handle().pipe(
			catchError((error) => {
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore
				// Captured directly (not through SentryService), so the tenant's own switch is checked here
				if (!isSentryReportingDisabledForRequest() && this.shouldReport(error)) {
					// In Sentry v9, we directly capture the exception
					Sentry.captureException(error);
				}

				return throwError(() => error);
			})
		);
	}
}
