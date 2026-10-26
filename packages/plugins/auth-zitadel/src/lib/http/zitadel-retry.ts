import { CallHandler, ExecutionContext, HttpException, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, throwError } from 'rxjs';

/** Seconds a client waits before trying a busy key again. */
export const HANDOFF_BUSY_RETRY_AFTER_SECONDS = 2;

/** The body of an answer that tells the client to try again later. */
export interface ZitadelRetryLaterBody {
	statusCode: number;
	code: 'handoff_busy' | 'handoff_throttled';
	message: string;
	/** Seconds to wait, also sent as `Retry-After`. */
	retryAfter: number;
}

/**
 * 409 `handoff_busy`: another attempt holds this key right now (for example a code check or a
 * sign-up that is still running). The key is still valid: the client tries again after `retryAfter`
 * seconds. A used-up or expired key answers 410 instead.
 */
export function handoffBusy(): HttpException {
	const body: ZitadelRetryLaterBody = {
		statusCode: HttpStatus.CONFLICT,
		code: 'handoff_busy',
		message: 'Another attempt is using this key. Try again in a moment.',
		retryAfter: HANDOFF_BUSY_RETRY_AFTER_SECONDS
	};
	return new HttpException(body, HttpStatus.CONFLICT);
}

/** 429 `handoff_throttled`: this key was used too often in the current window. */
export function handoffThrottled(retryAfter: number): HttpException {
	const body: ZitadelRetryLaterBody = {
		statusCode: HttpStatus.TOO_MANY_REQUESTS,
		code: 'handoff_throttled',
		message: 'Too many attempts with this key. Try again later.',
		retryAfter
	};
	return new HttpException(body, HttpStatus.TOO_MANY_REQUESTS);
}

/** The `retryAfter` hint of an error, when it carries one. */
export function retryAfterOf(error: unknown): number | undefined {
	if (!(error instanceof HttpException)) {
		return undefined;
	}
	const body = error.getResponse() as Partial<ZitadelRetryLaterBody> | string;
	const retryAfter = typeof body === 'object' && body ? body.retryAfter : undefined;
	return typeof retryAfter === 'number' && Number.isFinite(retryAfter) && retryAfter > 0
		? Math.ceil(retryAfter)
		: undefined;
}

/** Writes `Retry-After` on a response, when the platform's response object allows it. */
export function setRetryAfter(response: unknown, seconds: number): void {
	const target = response as { setHeader?: (name: string, value: string) => unknown } | undefined;
	target?.setHeader?.('Retry-After', String(seconds));
}

/**
 * Adds `Retry-After` to the answer of a route error that carries a `retryAfter` hint (409
 * `handoff_busy`), so clients that only read headers wait as well.
 */
@Injectable()
export class ZitadelRetryAfterInterceptor implements NestInterceptor {
	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		return next.handle().pipe(
			catchError((error) => {
				const seconds = retryAfterOf(error);
				if (seconds) {
					setRetryAfter(context.switchToHttp().getResponse(), seconds);
				}
				return throwError(() => error);
			})
		);
	}
}
