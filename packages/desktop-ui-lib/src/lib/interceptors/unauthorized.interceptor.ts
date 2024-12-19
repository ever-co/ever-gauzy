import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpStatusCode } from '@angular/common/http';
import { concatMap, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthStrategy } from '../auth';
import { ElectronService } from '../electron/services';
import { Router } from '@angular/router';
import { Store } from '../services';

@Injectable()
export class UnauthorizedInterceptor implements HttpInterceptor {
	constructor(
		private authStrategy: AuthStrategy,
		private electronService: ElectronService,
		private router: Router,
		private store: Store
	) {}

	intercept(
		request: HttpRequest<any>,
		next: HttpHandler
	): Observable<HttpEvent<any>> {
		return next.handle(request).pipe(
			catchError((error) => {
				// Early return if offline is triggered.
				if (this.store.isOffline) {
					return;
				}
				// Unauthorized error occurred
				if (error.status === HttpStatusCode.Unauthorized) {
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
				return throwError(() => error);
			})
		);
	}
}
