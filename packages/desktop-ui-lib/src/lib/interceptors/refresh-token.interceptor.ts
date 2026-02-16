import {
	HttpErrorResponse,
	HttpEvent,
	HttpHandler,
	HttpInterceptor,
	HttpRequest,
	HttpStatusCode
} from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, switchMap, take, throwError } from 'rxjs';
import { catchError, concatMap } from 'rxjs/operators';
import { SessionExpiredHandler, TokenRefreshHandler } from '../auth';
import { AUTH_ENDPOINTS } from '../constants';
import { Store } from '../services';

/**
 * HTTP interceptor that reacts to 401 Unauthorized responses.
 *
 * Behavior:
 * - For non-auth endpoints: Attempts token refresh and retries the request
 * - For auth endpoints: Triggers immediate logout (prevents infinite loops)
 * - Skips handling in offline mode or for non-401 errors
 */
@Injectable()
export class RefreshTokenInterceptor implements HttpInterceptor {
	private readonly store = inject(Store);
	private readonly tokenRefreshHandler = inject(TokenRefreshHandler);
	private readonly sessionExpiredHandler = inject(SessionExpiredHandler);

	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		return next.handle(request).pipe(
			catchError((error: HttpErrorResponse) => {
				// Regular endpoint 401 → attempt token refresh
				// Note: Token availability check moved to TokenRefreshExecutor
				// to prevent race conditions with concurrent requests
				return this.shouldSkipErrorHandling(error).pipe(
					take(1),
					switchMap((skip) => {
						if (skip) {
							return throwError(() => error);
						}
						// Auth endpoint 401 → immediate logout (no refresh attempt)
						if (this.isAuthEndpoint(request.url)) {
							return this.handleAuthEndpointFailure(error);
						}

						return this.tokenRefreshHandler.handle(request, next, error);
					})
				);
			})
		);
	}

	/**
	 * Guards that short-circuit error handling:
	 * - Offline mode — no network, nothing to retry.
	 * - Non-401 status — not an auth problem.
	 */
	private shouldSkipErrorHandling(error: HttpErrorResponse): Observable<boolean> {
		return this.store.isOffline$.pipe(
			map((isOffline) => isOffline || error.status !== HttpStatusCode.Unauthorized)
		);
	}

	/**
	 * Returns `true` when the URL matches a known authentication
	 * endpoint (login, register, refresh-token, etc.).
	 */
	private isAuthEndpoint(url: string): boolean {
		return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
	}

	/**
	 * Handles 401 from auth endpoints by triggering logout
	 * and re-throwing the original error.
	 */
	private handleAuthEndpointFailure(error: HttpErrorResponse): Observable<never> {
		return this.sessionExpiredHandler.execute().pipe(concatMap(() => throwError(() => error)));
	}
}
