import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpStatusCode } from '@angular/common/http';
import { concatMap, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthStrategy } from '../auth';
import { ElectronService } from '../electron/services';
import { Router } from '@angular/router';
import { Store, ErrorMapping } from '../services';

@Injectable()
export class UnauthorizedInterceptor implements HttpInterceptor {
	constructor(
		private authStrategy: AuthStrategy,
		private electronService: ElectronService,
		private router: Router,
		private store: Store,
		private _errorMapping: ErrorMapping
	) { }

	intercept(
		request: HttpRequest<any>,
		next: HttpHandler
	): Observable<HttpEvent<any>> {
		return next.handle(request).pipe(
			catchError((error) => {
				// Early return if offline is triggered.
				if (this.store.isOffline) {
					return throwError(() => {
						const message = this._errorMapping.mapErrorMessage(error);
						return new Error(message);
					});
				}
				
				// Unauthorized error occurred - but only logout if:
				// 1. It's from an auth endpoint (login, refresh-token failed)
				// 2. No refresh token is available
				if (error.status === HttpStatusCode.Unauthorized) {
					const isAuthEndpoint = this.isAuthEndpoint(request.url);
					const hasRefreshToken = !!this.store.refreshToken;
					
					// Only force logout if it's an auth endpoint failure or no refresh token
					// The RefreshTokenInterceptor will handle other 401s
					if (isAuthEndpoint || !hasRefreshToken) {
						// Log out the user
						this.authStrategy.logout();
						// logout from desktop
						this.electronService.ipcRenderer.send('logout');
						// redirect to login page
						concatMap(() =>
							this.router.navigate(['auth', 'login'], {
								queryParams: { returnUrl: this.router.url },
							})
						);
					}
				}

				return throwError(() => new Error(this._errorMapping.mapErrorMessage(error)));
			})
		);
	}

	/**
	 * Checks if the request URL is for an authentication endpoint
	 */
	private isAuthEndpoint(url: string): boolean {
		return url.includes('/auth/login') || 
		       url.includes('/auth/refresh-token') ||
		       url.includes('/auth/register') ||
		       url.includes('/auth/request-password') ||
		       url.includes('/auth/reset-password');
	}
}
