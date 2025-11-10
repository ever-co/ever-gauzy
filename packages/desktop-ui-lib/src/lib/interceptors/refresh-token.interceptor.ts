import {
	HttpErrorResponse,
	HttpEvent,
	HttpHandler,
	HttpInterceptor,
	HttpRequest,
	HttpStatusCode
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { NbAuthResult } from '@nebular/auth';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, finalize, switchMap, take } from 'rxjs/operators';
import { AuthStrategy } from '../auth';
import { AUTH_ENDPOINTS } from '../constants';
import { Store } from '../services';

/**
 * Interceptor that handles automatic token refresh when receiving 401 Unauthorized responses.
 * */

@Injectable()
export class RefreshTokenInterceptor implements HttpInterceptor {
	private isRefreshing = false;
	private refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

	constructor(private readonly authStrategy: AuthStrategy, private readonly store: Store) {}

	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		return next.handle(request).pipe(
			catchError((error: HttpErrorResponse) => {
				// Skip refresh if offline
				if (this.store.isOffline) {
					return throwError(() => error);
				}

				// Only handle 401 errors for non-auth endpoints
				if (error.status === HttpStatusCode.Unauthorized && !this.isAuthEndpoint(request.url)) {
					return this.handle401Error(request, next);
				}

				return throwError(() => error);
			})
		);
	}

	/**
	 * Handles 401 Unauthorized errors by attempting to refresh the token
	 * and retrying the original request with the new token.
	 */
	private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		if (!this.isRefreshing) {
			this.isRefreshing = true;
			this.refreshTokenSubject.next(null);

			const refreshToken = this.store.refreshToken;

			// If no refresh token is available, fail immediately
			if (!refreshToken) {
				this.isRefreshing = false;
				return throwError(() => new Error('No refresh token available'));
			}

			return this.authStrategy.refreshToken().pipe(
				switchMap((result: NbAuthResult) => {
					if (result.isSuccess()) {
						const newToken = this.store.token;
						this.refreshTokenSubject.next(newToken);
						return next.handle(this.addTokenToRequest(request, newToken));
					}

					// Refresh failed, propagate error
					return throwError(() => new Error('Token refresh failed'));
				}),
				catchError((error) => {
					// Token refresh failed completely
					return throwError(() => error);
				}),
				finalize(() => {
					this.isRefreshing = false;
				})
			);
		} else {
			// Token refresh is already in progress, wait for it to complete
			return this.refreshTokenSubject.pipe(
				filter((token) => token !== null),
				take(1),
				switchMap((token) => {
					return next.handle(this.addTokenToRequest(request, token));
				})
			);
		}
	}

	/**
	 * Adds the authorization token to the request headers
	 */
	private addTokenToRequest(request: HttpRequest<any>, token: string): HttpRequest<any> {
		return request.clone({
			setHeaders: {
				Authorization: `Bearer ${token}`
			}
		});
	}

	/**
	 * Checks if the request URL is for an authentication endpoint
	 * to avoid infinite refresh loops
	 */
	private isAuthEndpoint(url: string): boolean {
		return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
	}
}
