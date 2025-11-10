import { Injectable, Injector } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, from } from 'rxjs';
import { catchError, filter, take, switchMap, finalize } from 'rxjs/operators';
import { AuthService } from '../services/auth/auth.service';
import { Store } from '../services/store/store.service';

/**
 * Interceptor that automatically refreshes the access token when a 401 Unauthorized error occurs.
 * This prevents users from being logged out when their access token expires.
 * 
 * Based on the HubstaffTokenInterceptor pattern but applied to all API requests.
 */
@Injectable()
export class AuthRefreshInterceptor implements HttpInterceptor {
	private refreshTokenInProgress = false;
	private refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

	constructor(
		private readonly injector: Injector,
		private readonly store: Store
	) {}

	/**
	 * Intercepts HTTP requests and handles authentication token refresh if necessary.
	 *
	 * @param {HttpRequest<any>} req - The HTTP request to be intercepted.
	 * @param {HttpHandler} next - The next HTTP handler in the chain.
	 * @return {Observable<HttpEvent<any>>} - The intercepted HTTP request or an error.
	 */
	intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		// source from https://github.com/melcor76/interceptors/blob/master/src/app/interceptors/auth.interceptor.ts
		return next.handle(req).pipe(
			catchError((error: HttpErrorResponse) => {
				// Only handle 401 Unauthorized errors
				if (error?.status !== HttpStatusCode.Unauthorized) {
					return throwError(() => error);
				}

				// Don't attempt refresh for auth endpoints to avoid infinite loops
				if (this.isAuthEndpoint(req.url)) {
					return throwError(() => error);
				}

				// HttpStatus.UNAUTHORIZED errors are most likely going to be because we have an expired token that we need to refresh.
				if (this.refreshTokenInProgress) {
					// If refreshTokenInProgress is true, we will wait until refreshTokenSubject has a non-null value
					// which means the new token is ready and we can retry the request again
					return this.refreshTokenSubject.pipe(
						filter((result) => result !== null),
						take(1),
						switchMap((token) => next.handle(this.addToken(req, token!)))
					);
				} else {
					this.refreshTokenInProgress = true;

					// Set the refreshTokenSubject to null so that subsequent API calls will wait until the new token has been retrieved
					this.refreshTokenSubject.next(null);

					return this.refreshAccessToken().pipe(
						switchMap((response) => {
							if (response?.token) {
								// Update the token in the store
								this.store.token = response.token;
								this.refreshTokenSubject.next(response.token);
								return next.handle(this.addToken(req, response.token));
							}
							// If no token in response, throw error
							return throwError(() => error);
						}),
						catchError((refreshError) => {
							// Refresh failed, clear tokens and rethrow error
							// The application should handle this by redirecting to login
							return throwError(() => refreshError);
						}),
						// When the call to refreshToken completes we reset the refreshTokenInProgress to false
						// for the next time the token needs to be refreshed
						finalize(() => {
							this.refreshTokenInProgress = false;
						})
					);
				}
			})
		);
	}

	/**
	 * Refreshes the access token by calling the AuthService.
	 * @returns An Observable that emits the response of the token refresh request.
	 */
	private refreshAccessToken(): Observable<{ token: string } | null> {
		const refresh_token = this.store.refresh_token;
		
		if (!refresh_token) {
			return throwError(() => new Error('No refresh token available'));
		}

		const authService = this.injector.get(AuthService);
		return from(authService.refreshToken(refresh_token));
	}

	/**
	 * Adds an authentication token to the HTTP request headers.
	 * @param request The outgoing HTTP request.
	 * @param token The authentication token to be added.
	 * @returns A new HttpRequest object with the token added to the headers.
	 */
	private addToken(request: HttpRequest<any>, token: string): HttpRequest<any> {
		return request.clone({
			setHeaders: {
				Authorization: `Bearer ${token}`
			}
		});
	}

	/**
	 * Checks if the URL is an authentication endpoint that should not trigger token refresh.
	 * @param url The request URL to check.
	 * @returns True if the URL is an auth endpoint, false otherwise.
	 */
	private isAuthEndpoint(url: string): boolean {
		const authEndpoints = [
			'/auth/login',
			'/auth/register',
			'/auth/refresh-token',
			'/auth/request-password',
			'/auth/reset-password',
			'/auth/signin.email.password',
			'/auth/signin.email/confirm',
			'/auth/signin.workspace'
		];

		return authEndpoints.some(endpoint => url.includes(endpoint));
	}
}

