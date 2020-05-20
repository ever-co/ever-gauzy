import { Injectable, Injector } from '@angular/core';
import {
	HttpRequest,
	HttpHandler,
	HttpEvent,
	HttpInterceptor,
	HttpErrorResponse
} from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { HubstaffService } from './services/hubstaff.service';
import { catchError, filter, take, switchMap, finalize } from 'rxjs/operators';
import { BehaviorSubject, throwError } from 'rxjs';
import { HttpStatus } from '@gauzy/models';

@Injectable()
export class HubstaffTokenInterceptor implements HttpInterceptor {
	private refreshTokenInProgress = false;
	private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<
		any
	>(null);

	constructor(private injector: Injector) {}
	intercept(
		req: HttpRequest<any>,
		next: HttpHandler
	): Observable<HttpEvent<any>> {
		if (!req.url.includes('/integrations/hubstaff/')) {
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
							switchMap(({ access_token }) =>
								next.handle(
									this.addAuthenticationToken(
										req,
										access_token
									)
								)
							)
						);
					} else {
						this.refreshTokenInProgress = true;

						// Set the refreshTokenSubject to null so that subsequent API calls will wait until the new token has been retrieved
						this.refreshTokenSubject.next(null);

						return this.refreshAccessToken().pipe(
							switchMap(({ access_token }) => {
								this.refreshTokenSubject.next(access_token);
								return next.handle(
									this.addAuthenticationToken(
										req,
										access_token
									)
								);
							}),
							// When the call to refreshToken completes we reset the refreshTokenInProgress to false
							// for the next time the token needs to be refreshed
							finalize(
								() => (this.refreshTokenInProgress = false)
							)
						);
					}
				} else {
					return throwError(error);
				}
			})
		);
	}

	private refreshAccessToken(): Observable<any> {
		const hubstaffService = this.injector.get(HubstaffService);
		return hubstaffService.refreshToken();
	}

	private addAuthenticationToken(
		request: HttpRequest<any>,
		token
	): HttpRequest<any> {
		return request.clone({
			body: {
				token
			}
		});
	}
}
