import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable, combineLatest, switchMap, take, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { RequestMethodEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-sdk/common';

@UntilDestroy()
@Injectable()
export class TenantInterceptor implements HttpInterceptor {
	constructor(private readonly store: Store) {}

	/**
	 * Intercept HTTP requests and modify them based on user and organization information.
	 * @param request - The HttpRequest instance.
	 * @param next - The HttpHandler instance.
	 * @returns An Observable of HttpEvent<any>.
	 */
	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeUser$ = this.store.user$;

		/** */
		return combineLatest([storeUser$, storeOrganization$])
			.pipe(
				// Take only the first emission to avoid multiple subscriptions
				take(1),
				//
				tap(([user, organization]) => {
					if (!!user) {
						// Bind tenantId for DELETE http method
						const tenantId = user.tenantId;

						// Clone the request to modify it
						request = request.clone({
							...(request.method === RequestMethodEnum.DELETE
								? {
										setParams: {
											tenantId,
											...(organization ? { organizationId: organization.id } : {})
										}
								  }
								: {}),
							setHeaders: {
								'Tenant-Id': `${tenantId}`,
								...(organization ? { 'Organization-Id': `${organization.id}` } : {})
							}
						});
					}
				}),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.pipe(
				// Switch back to the original observable chain to perform the subscription
				switchMap(() => next.handle(request))
			);
	}
}
