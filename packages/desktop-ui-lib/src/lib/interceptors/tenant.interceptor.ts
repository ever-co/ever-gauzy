import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Store } from '../services';

@Injectable()
export class TenantInterceptor implements HttpInterceptor {
	constructor(private _store: Store) { }

	intercept(
		request: HttpRequest<unknown>,
		next: HttpHandler
	): Observable<HttpEvent<unknown>> {
		const tenantId = this._store.tenantId;
		if (tenantId) {
			request = request.clone({
				setHeaders: {
					'Tenant-Id': `${tenantId}`,
				},
			});
		}
		return next.handle(request);
	}
}
