import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { instanceToPlain } from 'class-transformer';
import { toSafeHttpException } from '../core/interceptors/safe-http-exception';

@Injectable()
export class PublicTransformInterceptor implements NestInterceptor {
	/**
	 * Intercepts the execution context and the call handler.
	 * Transforms the data using class-transformer's instanceToPlain.
	 * Catches and handles errors, returning appropriate exceptions.
	 * @param ctx - The execution context.
	 * @param next - The call handler.
	 * @returns An observable that represents the intercepted response.
	 */
	intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
		return next.handle().pipe(
			map((data) => instanceToPlain(data)),
			// One rule for every error that escapes a controller — see `toSafeHttpException`:
			// BadRequest bodies intact, other HTTP exceptions keep their STRUCTURED body minus
			// driver/transport internals, non-HTTP errors become a real 5xx (never a 200).
			catchError((error: unknown) => {
				throw toSafeHttpException(error);
			})
		);
	}
}
