import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Store } from '../services';

@Injectable()
export class OrganizationInterceptor implements HttpInterceptor {
	constructor(private _store: Store) {}

	intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
		const organizationId = this._store.organizationId;
		if (organizationId) {
			request = request.clone({
				setHeaders: {
					'Organization-Id': `${organizationId}`
				}
			});
		}
		return next.handle(request);
	}
}
