import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Handlers } from '@sentry/node';
import { Observable, catchError, throwError } from 'rxjs';
import { SentryInterceptor } from './ntegral';

export class SentryCustomInterceptor extends SentryInterceptor {
	private readonly handler = Handlers.errorHandler();

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
				if (this.shouldReport(error)) {
					const http = context.switchToHttp();
					this.handler(error, http.getRequest(), http.getResponse(), () => {});
				}

				return throwError(() => error);
			})
		);
	}
}
