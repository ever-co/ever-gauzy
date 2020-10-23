import { Injectable } from '@angular/core';
import {
	HttpRequest,
	HttpHandler,
	HttpEvent,
	HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { Store } from './services/store.service';
import { filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy()
@Injectable()
export class TenantInterceptor implements HttpInterceptor {
	constructor(private store: Store) {}

	intercept(
		request: HttpRequest<any>,
		next: HttpHandler
	): Observable<HttpEvent<any>> {
		this.store.user$
			.pipe(
				untilDestroyed(this),
				filter((user) => !!user)
			)
			.subscribe((user) => {
				request = request.clone({
					setHeaders: {
						'Tenant-ID': `${user.tenantId}`
					}
				});
			});
		return next.handle(request);
	}
}
