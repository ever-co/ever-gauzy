import { Injectable } from '@angular/core';
import {
	HttpRequest,
	HttpHandler,
	HttpEvent,
	HttpInterceptor
} from '@angular/common/http';
import { Observable, combineLatest, tap } from 'rxjs';
import { filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { isNotEmpty } from '@gauzy/common-angular';
import { RequestMethodEnum } from '@gauzy/contracts';
import { Store } from './../services';

@UntilDestroy()
@Injectable()
export class TenantInterceptor implements HttpInterceptor {

	constructor(
		private readonly store: Store
	) { }

	intercept(
		request: HttpRequest<any>,
		next: HttpHandler
	): Observable<HttpEvent<any>> {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeUser$ = this.store.user$;

		combineLatest([storeUser$, storeOrganization$])
			.pipe(
				filter(([user]) => !!user),
				tap(([user, organization]) => {
					//bind tenantId for DELETE http method
					const tenantId = user.tenantId;
					if (request.method === RequestMethodEnum.DELETE) {
						request = request.clone({
							setParams: {
								tenantId
							}
						});
					}
					request = request.clone({
						setHeaders: {
							'Tenant-Id': `${tenantId}`,
						}
					});
					request = request.clone({
						setHeaders: {
							...(isNotEmpty(organization)
								? {
									'Organization-Id': `${organization.id}`
								}
								: {}),
						}
					});
				}),
				untilDestroyed(this)
			)
			.subscribe();
		return next.handle(request);
	}
}
