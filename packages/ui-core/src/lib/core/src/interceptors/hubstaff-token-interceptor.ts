import { Injectable, Injector } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { catchError, filter, take, switchMap, finalize } from 'rxjs/operators';
import { HttpStatus } from '@gauzy/contracts';
import { HubstaffService } from '../services';

@Injectable()
export class HubstaffTokenInterceptor implements HttpInterceptor {
	private refreshTokenInProgress = false;
	private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

	constructor(private readonly injector: Injector) {}

	/**
	 * Intercepts HTTP requests and handles authentication token refresh if necessary.
	 *
	 * @param {HttpRequest<any>} req - The HTTP request to be intercepted.
	 * @param {HttpHandler} next - The next HTTP handler in the chain.
	 * @return {Observable<HttpEvent<any>>} - The intercepted HTTP request or an error.
	 */
	intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		if (!req.url.includes('/integration/hubstaff/')) {
			return next.handle(req);
		}

		// source from https://github.com/melcor76/interceptors/blob/master/src/app/interceptors/auth.interceptor.ts
		return next.handle(req).pipe(
			catchError((error: HttpErrorResponse) => {
				if (error && error.status === HttpStatus.UNAUTHORIZED) {
					// 401 errors are most likely going to be because we have an expired token that we need to refresh.
					if (this.refreshTokenInProgress) {
						// If refreshTokenInProgress is true, we will wait until refreshTokenSubject has a non-null value
						// which means the new token is ready and we can retry the request again
						return this.refreshTokenSubject.pipe(
							filter((result) => result !== null),
							take(1),
							switchMap(({ access_token }) => next.handle(this.addAuthenticationToken(req, access_token)))
						);
					} else {
						this.refreshTokenInProgress = true;

						// Set the refreshTokenSubject to null so that subsequent API calls will wait until the new token has been retrieved
						this.refreshTokenSubject.next(null);

						return this.refreshAccessToken().pipe(
							switchMap(({ access_token }) => {
								this.refreshTokenSubject.next(access_token);
								return next.handle(this.addAuthenticationToken(req, access_token));
							}),
							// When the call to refreshToken completes we reset the refreshTokenInProgress to false
							// for the next time the token needs to be refreshed
							finalize(() => (this.refreshTokenInProgress = false))
						);
					}
				}
			})
		);
	}

	/**
	 * Refreshes the access token by calling the HubstaffService.
	 * @returns An Observable that emits the response of the token refresh request.
	 */
	private refreshAccessToken(): Observable<any> {
		const service = this.injector.get(HubstaffService);
		return service.refreshToken();
	}

	/**
	 * Adds an authentication token to the HTTP request body.
	 * @param request The outgoing HTTP request.
	 * @param token The authentication token to be added.
	 * @returns A new HttpRequest object with the token added to the body.
	 */
	private addAuthenticationToken(request: HttpRequest<any>, token): HttpRequest<any> {
		return request.clone({
			body: {
				token
			}
		});
	}
}
