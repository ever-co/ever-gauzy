import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Observable, catchError, retry, throwError } from 'rxjs';
import { ErrorHandlerService } from '../services/error-handler.service';
import { Store } from '../services';
import { ElectronService } from '../electron/services';

@Injectable()
export class ServerErrorInterceptor implements HttpInterceptor {
	constructor(
		private readonly _errorHandlerService: ErrorHandlerService,
		private readonly _electronService: ElectronService,
		private readonly _store: Store
	) { }
	intercept(
		request: HttpRequest<any>,
		next: HttpHandler
	): Observable<HttpEvent<any>> {
		return next.handle(request).pipe(
			retry(1),
			catchError((error: HttpErrorResponse) =>
				throwError(() => {
					if (!this._store.isOffline) {
						if (
							error.status >= HttpStatusCode.InternalServerError ||
							error.status < HttpStatusCode.Continue
						) {
							this._store.isOffline = true;
							this._electronService.ipcRenderer.send(
								'server-down'
							);
						}
						this._errorHandlerService.handleError(error);
					}
					return error;
				})
			)
		);
	}
}
