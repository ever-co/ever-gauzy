import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
	HttpRequest,
	HttpHandler,
	HttpEvent,
	HttpInterceptor,
	HttpErrorResponse,
	HttpStatusCode
} from '@angular/common/http';
import { Observable, Subject, throwError, from } from 'rxjs';
import { catchError, take, switchMap, finalize } from 'rxjs/operators';
import { AuthService } from '../services/auth/auth.service';
import { Store } from '../services/store/store.service';

/**
 * Interceptor that automatically refreshes the access token when a 401 Unauthorized error occurs.
 * This prevents users from being logged out when their access token expires.
 */
@Injectable()
export class AuthRefreshInterceptor implements HttpInterceptor {
	private readonly authService = inject(AuthService);
	private readonly store = inject(Store);
	private readonly router = inject(Router);

	private refreshTokenInProgress = false;
	private refreshTokenSubject: Subject<string> = new Subject<string>();

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
					// If refreshTokenInProgress is true, we will wait until refreshTokenSubject emits the new token
					// This ensures all pending requests use the same refreshed token
					return this.refreshTokenSubject.pipe(
						take(1),
						switchMap((token) => next.handle(this.addToken(req, token)))
					);
				} else {
					this.refreshTokenInProgress = true;

					return this.refreshAccessToken().pipe(
						switchMap((response) => {
							if (response?.token) {
								// Update the token in the store
								this.store.token = response.token;
								// Emit the new token to all waiting requests
								this.refreshTokenSubject.next(response.token);
								return next.handle(this.addToken(req, response.token));
							}
							// If no token in response, throw error
							return throwError(() => error);
						}),
						catchError((refreshError) => {
							// Refresh failed, clear tokens
							this.store.token = null;
							this.store.refresh_token = null;
							// Emit error to all waiting requests (completes the Subject)
							this.refreshTokenSubject.error(refreshError);
							// Recreate Subject since .error() completes it and makes it unusable
							this.refreshTokenSubject = new Subject<string>();
							// Redirect to login page
							this.router.navigate(['/auth/login'], {
								queryParams: { returnUrl: this.router.url }
							});
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

		return from(this.authService.refreshToken(refresh_token));
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
			'/auth/signin.email',
			'/auth/signin.email/confirm',
			'/auth/signin.workspace',
			'/auth/signin.email.social',
			'/auth/signup.provider.social',
			'/auth/signup.link.account',
			'/auth/google',
			'/auth/google/callback',
			'/auth/facebook',
			'/auth/facebook/callback',
			'/auth/github',
			'/auth/github/callback',
			'/auth/linkedin',
			'/auth/linkedin/callback',
			'/auth/twitter',
			'/auth/twitter/callback',
			'/auth/microsoft',
			'/auth/microsoft/callback',
			'/auth/auth0',
			'/auth/auth0/callback'
		];

		return authEndpoints.some((endpoint) => {
			const pattern = new RegExp(`${endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/|\\?|$)`);
			return pattern.test(url);
		});
	}
}
