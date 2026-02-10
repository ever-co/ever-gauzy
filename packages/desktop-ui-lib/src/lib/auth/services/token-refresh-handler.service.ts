import { HttpErrorResponse, HttpEvent, HttpHandler, HttpRequest } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NbAuthResult } from '@nebular/auth';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, concatMap, filter, finalize, switchMap, take } from 'rxjs/operators';
import { Store } from '../../services';
import { AuthStrategy } from './auth-strategy.service';
import { SessionExpiredHandler } from './session-expired-handler.service';

/**
 * Manages the token-refresh lifecycle for 401 responses.
 */
@Injectable({
	providedIn: 'root'
})
export class TokenRefreshHandler {
	private readonly authStrategy = inject(AuthStrategy);
	private readonly store = inject(Store);
	private readonly sessionExpiredHandler = inject(SessionExpiredHandler);

	/** Whether a refresh request is currently in-flight. */
	private isRefreshing = false;

	/** Gate subject — emits `null` while refreshing, the new token on success. */
	private refreshToken$ = new BehaviorSubject<string | null>(null);

	/**
	 * Entry point called by the interceptor on every 401 response.
	 *
	 * @param request  The original failed request
	 * @param next     The HTTP handler to replay the request through
	 * @param originalError The original 401 `HttpErrorResponse` (preserved)
	 * @returns An observable of the retried (or failed) HTTP event
	 */
	handle(request: HttpRequest<any>, next: HttpHandler, originalError: HttpErrorResponse): Observable<HttpEvent<any>> {
		if (this.isRefreshing) {
			return this.waitForRefresh(request, next);
		}
		return this.initiateRefresh(request, next, originalError);
	}

	// ──────────────────────────────────────────────
	// Private helpers
	// ──────────────────────────────────────────────

	/**
	 * Kicks off the actual refresh flow. Only one refresh runs at a time.
	 */
	private initiateRefresh(
		request: HttpRequest<any>,
		next: HttpHandler,
		originalError: HttpErrorResponse
	): Observable<HttpEvent<any>> {
		this.isRefreshing = true;
		this.refreshToken$.next(null);

		// No refresh token available → session is unrecoverable
		if (!this.store.refreshToken) {
			this.isRefreshing = false;
			return this.handleSessionExpiry(originalError);
		}

		return this.authStrategy.refreshToken().pipe(
			switchMap((result: NbAuthResult) => {
				if (result.isSuccess()) {
					const newToken = this.store.token;
					// Unblock any queued requests
					this.refreshToken$.next(newToken);
					return next.handle(this.cloneWithToken(request, newToken));
				}

				// Refresh returned a non-success result → force logout
				// Signal failure to queued requests by erroring the subject
				this.refreshToken$.error(originalError);
				return this.handleSessionExpiry(originalError);
			}),
			catchError(() => {
				// Network/server error during refresh → force logout,
				// Signal failure to queued requests by erroring the subject
				this.refreshToken$.error(originalError);
				return this.handleSessionExpiry(originalError);
			}),
			finalize(() => {
				this.isRefreshing = false;
				// Recreate the subject for subsequent refresh cycles
				this.refreshToken$ = new BehaviorSubject<string | null>(null);
			})
		);
	}

	/**
	 * Queues concurrent 401 requests behind the in-flight refresh.
	 * They resume as soon as `refreshTokenSubject` emits a non-null token.
	 * If the refresh fails, the error is propagated to all queued requests.
	 */
	private waitForRefresh(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		return this.refreshToken$.pipe(
			filter((token): token is string => token !== null),
			take(1),
			switchMap((token) => next.handle(this.cloneWithToken(request, token))),
			catchError((error) => throwError(() => error))
		);
	}

	/**
	 * Delegates to `SessionExpiredHandler` and then re-throws the
	 * **original** `HttpErrorResponse` so upstream consumers see the
	 * real HTTP status (e.g. 401) rather than a synthetic error.
	 */
	private handleSessionExpiry(originalError: HttpErrorResponse): Observable<never> {
		return this.sessionExpiredHandler.execute().pipe(concatMap(() => throwError(() => originalError)));
	}

	/**
	 * Clones the request with an updated Authorization header.
	 */
	private cloneWithToken(request: HttpRequest<any>, token: string): HttpRequest<any> {
		return request.clone({
			setHeaders: { Authorization: `Bearer ${token}` }
		});
	}
}
