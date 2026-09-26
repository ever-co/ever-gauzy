import { CallHandler, ExecutionContext, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import {
	ACCEPTED_OPERATION_METADATA,
	IAcceptedOperationOptions,
	isOperationRef,
	locateOperation
} from './async-operation';

/** The header a retried request carries so a second submission resolves to the first operation. */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/**
 * Turns a handler's operation reference into an accepted response.
 *
 * It is mounted by `@AcceptedOperation`, never globally, so a route that has not declared the
 * convention behaves exactly as it does today — including a route that returns a reference by
 * accident, which is why the declaration is what enables the convention and the return shape alone
 * is not enough.
 *
 * What the interceptor owns, in the order the four things happen:
 *
 * 1. the `Idempotency-Key` requirement, checked **before the handler runs**, so work that cannot be
 *    correlated with a retry is never started;
 * 2. the `Location` header, derived from the reference;
 * 3. the `Retry-After` header, so a polling client is told how long to wait rather than guessing;
 * 4. the `202` status and the body, which repeats the location for a client that cannot read headers.
 *
 * A handler that returns anything other than a reference passes through untouched, so a route may
 * accept work on one branch and return a resource on another.
 */
@Injectable()
export class AcceptedOperationInterceptor implements NestInterceptor {
	constructor(private readonly reflector: Reflector) {}

	/**
	 * Applies the convention to a declared route.
	 *
	 * @param context The execution context.
	 * @param next The call handler.
	 * @returns The accepted response, or the handler's own value when it did not accept anything.
	 * @throws ApiException `400 IDEMPOTENCY_KEY_REQUIRED` when the declared route was called without
	 * the header, before the handler runs.
	 */
	public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const options = this.reflector.getAllAndOverride<IAcceptedOperationOptions>(ACCEPTED_OPERATION_METADATA, [
			context.getHandler(),
			context.getClass()
		]);

		// No declaration, or a surface without response headers: the handler's value is the response.
		// A GraphQL mutation carries the same body as its payload and needs neither header nor status.
		if (!options || context.getType() !== 'http') {
			return next.handle();
		}

		const http = context.switchToHttp();
		const request = http.getRequest();

		if (options.requireIdempotencyKey !== false) {
			this.requireIdempotencyKey(request);
		}

		return next.handle().pipe(
			map((value: unknown) => {
				if (!isOperationRef(value)) {
					return value;
				}

				const located = locateOperation(value, {
					declaredType: options.type,
					locationOf: options.locationOf,
					retryAfterSeconds: options.retryAfterSeconds
				});

				const response = http.getResponse();

				// The status is set here rather than by `@HttpCode(202)` on the route, because a handler
				// that returned a resource on another branch would be mislabelled by a route-level code.
				response?.setHeader?.('Location', located.location);
				response?.setHeader?.('Retry-After', String(located.retryAfterSeconds));
				response?.status?.(HttpStatus.ACCEPTED);

				return located.accepted;
			})
		);
	}

	/**
	 * Refuses a request that carries no idempotency key.
	 *
	 * @param request The HTTP request.
	 * @throws ApiException `400 IDEMPOTENCY_KEY_REQUIRED`.
	 */
	private requireIdempotencyKey(request: unknown): void {
		if (readIdempotencyKey(request)) {
			return;
		}

		throw new ApiException(
			HttpStatus.BAD_REQUEST,
			ApiErrorCode.IDEMPOTENCY_KEY_REQUIRED,
			`This route requires an ${IDEMPOTENCY_KEY_HEADER} header, so a retry resolves to the same operation.`,
			{ header: IDEMPOTENCY_KEY_HEADER }
		);
	}
}

/**
 * The idempotency key a request carries.
 *
 * The header is read through the request's own accessor when it has one — Express exposes one, and a
 * proxy may have normalized the headers on the way in — and from the headers object otherwise.
 *
 * @param request The HTTP request.
 * @returns The trimmed key, or undefined when the request carries none.
 */
export function readIdempotencyKey(request: unknown): string | undefined {
	const source = request as { get?: (name: string) => unknown; headers?: Record<string, unknown> };
	const fromAccessor = typeof source?.get === 'function' ? source.get(IDEMPOTENCY_KEY_HEADER) : undefined;
	const fromHeaders = source?.headers?.[IDEMPOTENCY_KEY_HEADER.toLowerCase()];
	const raw = typeof fromAccessor === 'string' ? fromAccessor : fromHeaders;

	return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : undefined;
}
