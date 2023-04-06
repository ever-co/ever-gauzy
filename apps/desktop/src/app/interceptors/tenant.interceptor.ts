import { Injectable } from '@angular/core';
import {
	HttpRequest,
	HttpHandler,
	HttpEvent,
	HttpInterceptor,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { Store } from '@gauzy/desktop-timer/src/app/auth/services/store.service';

@Injectable()
export class TenantInterceptor implements HttpInterceptor {
	constructor(private _store: Store) { }

	intercept(
		request: HttpRequest<any>,
		next: HttpHandler
	): Observable<HttpEvent<any>> {
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
