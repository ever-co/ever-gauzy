import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { executionRequest, executionResponse, setResponseHeader } from '../core/context/execution-context.util';
import { VERSIONED_METADATA_KEY, formatEntityTag, parseEntityVersion } from './version.util';
import type { IVersionedOptions } from './versioned.decorator';

/**
 * Publishes the version a response is at.
 *
 * A conditional write is only possible if the caller can learn the version it is conditioning on,
 * so every response from a `@Versioned()` route carries the record's version twice: in the body,
 * where a client reads it as a property, and in an `ETag`, where a client that caches the response
 * gets it for free and an HTTP client can send it straight back as `If-Match`.
 *
 * On a route that has not opted in, no header is written and the body is untouched, so the bytes a
 * caller receives today are the bytes it receives after this lands.
 */
@Injectable()
export class VersionInterceptor implements NestInterceptor {
	constructor(private readonly reflector: Reflector) {}

	/**
	 * Adds the entity tag to a response that carries a version.
	 *
	 * @param context The execution context.
	 * @param next The handler.
	 * @returns The handler's response, with its version published.
	 */
	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const options = this.reflector.getAllAndOverride<IVersionedOptions | undefined>(VERSIONED_METADATA_KEY, [
			context.getHandler(),
			context.getClass()
		]);

		if (options === undefined) {
			return next.handle();
		}

		return next.handle().pipe(
			map((result) => {
				const version = parseEntityVersion(result?.['version']);

				if (version !== null) {
					const response = executionResponse(context, executionRequest(context));

					setResponseHeader(response, 'ETag', formatEntityTag(version));
				}

				return result;
			})
		);
	}
}
