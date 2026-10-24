import { Injectable, NestInterceptor, ExecutionContext, CallHandler, StreamableFile } from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { instanceToPlain } from 'class-transformer';
import { toSafeHttpException } from './safe-http-exception';
import { scrubUserCredentials } from './user-credential-scrub';

/**
 * A response body with nothing to serialise: a primitive (`instanceToPlain` returns it unchanged), nothing at all,
 * or bytes - a Buffer, a stream or a `StreamableFile` - which `instanceToPlain` would have copied property by
 * property into a plain object.
 */
function isPassedThrough(data: unknown): boolean {
	return (
		data === null ||
		typeof data !== 'object' ||
		Buffer.isBuffer(data) ||
		data instanceof StreamableFile ||
		typeof (data as { pipe?: unknown }).pipe === 'function'
	);
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
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
			// Transform the data using class-transformer's instanceToPlain, then strip credential columns
			// from any user that reached it WITHOUT its prototype (object spread, MikroORM `toJSON()`),
			// where `@Exclude` cannot apply (GHSA-hh83-hq74-gh9f)
			map((data) => (isPassedThrough(data) ? data : scrubUserCredentials(instanceToPlain(data)))),
			// Catch and handle errors
			// One rule for every error that escapes a controller — see `toSafeHttpException`:
			// BadRequest bodies intact, other HTTP exceptions keep their STRUCTURED body minus
			// driver/transport internals, non-HTTP errors become a real 5xx (never a 200).
			catchError((error: unknown) => {
				throw toSafeHttpException(error);
			})
		);
	}
}
