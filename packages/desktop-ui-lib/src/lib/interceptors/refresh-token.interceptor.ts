import {
	HttpErrorResponse,
	type HttpEvent,
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
import { SKIP_TOKEN_REFRESH } from './skip-token-refresh.token';

/**
 * HTTP interceptor that reacts to 401 Unauthorized responses.
 *
 * Behavior:
 * - For non-auth endpoints: Attempts token refresh and retries the request
 * - For auth endpoints: Triggers immediate logout (prevents infinite loops)
 * - Skips handling in offline mode, for non-401 errors and for requests marked with `SKIP_TOKEN_REFRESH`
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
				return this.shouldSkipErrorHandling(request, error).pipe(
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
	 * - `SKIP_TOKEN_REFRESH` on the request — its caller handles the 401 itself (no refresh, retry or logout).
	 */
	private shouldSkipErrorHandling(request: HttpRequest<any>, error: HttpErrorResponse): Observable<boolean> {
		return this.store.isOffline$.pipe(
			map(
				(isOffline) =>
					isOffline || error.status !== HttpStatusCode.Unauthorized || request.context.get(SKIP_TOKEN_REFRESH)
			)
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
	 * Handles 401 from auth endpoints by triggering logout only when
	 * there is an authenticated session to clear.
	 * and re-throwing the original error.
	 */
	private handleAuthEndpointFailure(error: HttpErrorResponse): Observable<never> {
		return this.store.isAuthenticated$.pipe(
			take(1),
			switchMap((isAuthenticated) => {
				if (!isAuthenticated) {
					return throwError(() => error);
				}
				return this.sessionExpiredHandler.execute().pipe(concatMap(() => throwError(() => error)));
			})
		);
	}
}
