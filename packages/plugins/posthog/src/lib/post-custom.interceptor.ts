import { CallHandler, ExecutionContext, HttpException } from '@nestjs/common';
import { Observable, catchError, throwError } from 'rxjs';
import { PosthogErrorInterceptor } from './posthog-error.interceptor';

export class PosthogCustomInterceptor extends PosthogErrorInterceptor {
	constructor() {
		super({
			filters: [
				// Filter out non-critical HTTP exceptions (client errors 4xx)
				{
					type: HttpException,
					filter: (e: HttpException) => e.getStatus() < 500
				}
				// Add other filters as needed
			]
		});
	}

	/**
	 * Intercepts the execution context and handles errors
	 * @param {ExecutionContext} context - Execution context
	 * @param {CallHandler} next - Call handler
	 * @returns {Observable<any>} Observable representing the intercepted operation result
	 */
	public override intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		return next.handle().pipe(
			catchError((error) => {
				if (this.shouldReport(error)) {
					// Use parent's captureException method which handles all context types
					this.captureException(context, error);
				}

				return throwError(() => error);
			})
		);
	}
}
