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
import { RequestMethodEnum } from '@gauzy/contracts';

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
				//bind tenantId for DELETE http method
				const tenantId = user.tenantId;
				if (request.method === RequestMethodEnum.DELETE) {
					const params = { tenantId };
					request = request.clone({
						setParams: params
					});
				}

				request = request.clone({
					setHeaders: {
						'Tenant-ID': `${tenantId}`
					}
				});
			});
		return next.handle(request);
	}
}
