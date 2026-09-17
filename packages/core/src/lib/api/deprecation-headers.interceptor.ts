import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { readDeprecationNotices } from './legacy-data';

/**
 * Writes the deprecation notices a request recorded onto its response.
 *
 * The query pipe records and this interceptor writes, and the split is what makes the notice
 * survive every way a response can be produced: a handler that returns a page, a handler that
 * throws, and a filter that answers instead of the handler. Writing from the pipe would cover only
 * the first.
 *
 * It is mounted by the `@ApiQuery()` decorator beside the pipe and never globally, so a route that
 * has not adopted the query protocol writes no headers it did not write before — which is the
 * property that makes the header a migration signal rather than decoration.
 */
@Injectable()
export class DeprecationHeadersInterceptor implements NestInterceptor {
	/**
	 * Copies the recorded notices onto the response.
	 *
	 * @param context The execution context.
	 * @param next The handler.
	 * @returns The handler's stream, unchanged.
	 */
	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		// A GraphQL execution context has no HTTP response, and a resolver may legitimately carry
		// this interceptor through the composite decorator; there is simply nothing to write.
		if (context.getType<'http' | 'graphql' | string>() !== 'http') {
			return next.handle();
		}

		const request = context.switchToHttp().getRequest();
		const notices = readDeprecationNotices(request);
		const headers = Object.keys(notices);
		if (headers.length === 0) {
			return next.handle();
		}

		const response = context.switchToHttp().getResponse();
		if (!response || typeof response.setHeader !== 'function') {
			return next.handle();
		}
		for (const header of headers) {
			const values = notices[header];
			// Repeated values are written as a list: a caller that dropped three relations should be
			// able to see all three, not the first one.
			response.setHeader(header, values.length === 1 ? values[0] : values);
		}
		return next.handle();
	}
}
