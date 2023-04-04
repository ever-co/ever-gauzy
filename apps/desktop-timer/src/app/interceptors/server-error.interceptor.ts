import { Injectable } from '@angular/core';
import {
	HttpRequest,
	HttpHandler,
	HttpEvent,
	HttpInterceptor,
	HttpErrorResponse,
} from '@angular/common/http';
import { Observable, catchError, retry, throwError } from 'rxjs';
import { ErrorHandlerService } from '../services/error-handler.service';
import { Store } from '../auth/services/store.service';

@Injectable()
export class ServerErrorInterceptor implements HttpInterceptor {
	constructor(
		private readonly _errorHandlerService: ErrorHandlerService,
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
						this._errorHandlerService.handleError(error);
					}
					return error;
				})
			)
		);
	}
}
