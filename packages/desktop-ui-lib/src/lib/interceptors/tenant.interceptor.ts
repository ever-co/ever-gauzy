import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Store } from '../services';

@Injectable()
export class TenantInterceptor implements HttpInterceptor {
	constructor(private _store: Store) {}

	intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
		const tenantId = this._store.tenantId;
		const organizationId = this._store.organizationId;

		if (tenantId && organizationId) {
			request = request.clone({
				setHeaders: {
					'Tenant-Id': `${tenantId}`,
					'Organization-ID': `${organizationId}`
				}
			});
		}
		return next.handle(request);
	}
}
