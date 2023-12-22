import {
	CallHandler,
	ExecutionContext
	// HttpException
} from '@nestjs/common';
import {
	SentryInterceptor
	// ,InjectSentry
	// ,SentryService
} from '@travelerdev/nestjs-sentry';
import { Handlers } from '@sentry/node';
import { Observable, catchError, throwError } from 'rxjs';
// import { EntityNotFoundError } from 'typeorm';

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
