import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
	HttpRequest,
	HttpHandler,
	type HttpEvent,
	HttpInterceptor,
	HttpErrorResponse,
	HttpParams,
	HttpStatusCode
} from '@angular/common/http';
import { EMPTY, Observable, ReplaySubject, throwError, from } from 'rxjs';
import { catchError, concatWith, ignoreElements, take, switchMap, finalize } from 'rxjs/operators';
import { environment } from '@gauzy/ui-config';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { AuthService } from '../services/auth/auth.service';
import { Store } from '../services/store/store.service';
import { isAuthUrl, LOGIN_URL, loginReturnUrl } from '../auth/login-return-url';

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
	private refreshTokenSubject: ReplaySubject<string> = new ReplaySubject<string>(1);

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
						switchMap((token) => this.replay(req, next, token))
					);
				} else {
					this.refreshTokenInProgress = true;
					// One subject per refresh, replaying its token: a request that fails after the token is
					// published, while the first replay is still running, gets it instead of waiting forever
					this.refreshTokenSubject = new ReplaySubject<string>(1);

					return this.refreshAccessToken().pipe(
						catchError((refreshError) => this.handleRefreshFailure(refreshError)),
						switchMap((response) => {
							if (response?.token) {
								// Update the token in the store
								this.store.token = response.token;
								// Update refresh token
								this.store.refresh_token = response.refresh_token;
								// Emit the new token to all waiting requests
								this.refreshTokenSubject.next(response.token);
								return this.replay(req, next, response.token);
							}
							// If no token in response, throw error
							return this.handleRefreshFailure(error);
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
	 * Ends the session when its token cannot be refreshed: clears the token pair, fails the requests waiting
	 * on the refresh and sends the user to the sign-in page.
	 */
	private handleRefreshFailure(refreshError: unknown): Observable<never> {
		// Refresh failed, clear tokens
		this.store.token = null;
		this.store.refresh_token = null;
		// Emit error to all waiting requests (completes the Subject, the next refresh creates its own)
		this.refreshTokenSubject.error(refreshError);
		// Redirect to login page
		this.redirectToLogin();
		return throwError(() => refreshError);
	}

	/**
	 * Replays a request with the refreshed token, the one that started the refresh as well as the ones that waited
	 * on it, so their errors go through the same handling.
	 */
	private replay(req: HttpRequest<any>, next: HttpHandler, token: string): Observable<HttpEvent<any>> {
		return next
			.handle(this.addToken(req, token))
			.pipe(catchError((retryError: HttpErrorResponse) => this.handleRetryFailure(retryError, req, next, token)));
	}

	/**
	 * Handles an error of the request replayed with the refreshed token.
	 *
	 * The refresh succeeded, so the error belongs to that request: a route can answer 401 for its own reason
	 * (an integration whose upstream credentials are rejected). The session ends only when the API also rejects
	 * the new token on `/user/me`, as it does for a user no longer in the organization of their token.
	 */
	private handleRetryFailure(
		retryError: HttpErrorResponse,
		req: HttpRequest<any>,
		next: HttpHandler,
		token: string
	): Observable<never> {
		if (retryError?.status !== HttpStatusCode.Unauthorized) {
			return throwError(() => retryError);
		}

		return next.handle(this.sessionProbe(req, token)).pipe(
			ignoreElements(),
			catchError((probeError: HttpErrorResponse) =>
				probeError?.status === HttpStatusCode.Unauthorized ? this.handleRefreshFailure(retryError) : EMPTY
			),
			concatWith(throwError(() => retryError))
		);
	}

	/**
	 * Builds `GET /user/me` with the refreshed token and the headers of the original request. It is sent through
	 * `next`, after APIInterceptor has run, so the base URL is added here the same way.
	 */
	private sessionProbe(req: HttpRequest<any>, token: string): HttpRequest<any> {
		return this.addToken(req, token).clone({
			method: 'GET',
			url: `${environment.API_BASE_URL || ''}${API_PREFIX}/user/me`,
			body: null,
			params: new HttpParams()
		});
	}

	/**
	 * Sends the user to the sign-in page once, with the page to come back to (Q8d).
	 *
	 * A stale session fails every request it makes, and each failure used to redirect with
	 * `returnUrl: router.url`. The second one ran while the first redirect was on screen, so it wrapped the
	 * sign-in URL in itself (`/auth/login?returnUrl=/auth/login?returnUrl=…`), and every redirect started a new
	 * navigation that superseded the one before it — the app's skeleton waits for a navigation to end, so it
	 * stayed up. A redirect is now skipped when the router is already on, or already on its way to, an
	 * authentication page, and the return URL is never an authentication page itself.
	 */
	private redirectToLogin(): void {
		const pending = this.router.getCurrentNavigation();
		const target = pending ? this.router.serializeUrl(pending.finalUrl ?? pending.extractedUrl) : null;

		if (isAuthUrl(this.router.url) || (target !== null && isAuthUrl(target))) {
			return;
		}

		const returnUrl = loginReturnUrl(target ?? this.router.url);

		this.router.navigate([LOGIN_URL], returnUrl ? { queryParams: { returnUrl } } : {});
	}

	/**
	 * Refreshes the access token by calling the AuthService.
	 * @returns An Observable that emits the response of the token refresh request.
	 */
	private refreshAccessToken(): Observable<{ token: string; refresh_token: string } | null> {
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
			'/auth/switch-workspace',
			'/auth/switch-organization',
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
