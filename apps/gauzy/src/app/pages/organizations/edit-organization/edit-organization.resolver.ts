import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { debounceTime, EMPTY, Observable, of as observableOf } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { IOrganization } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/ui-sdk/common';
import { OrganizationsService } from '@gauzy/ui-sdk/core';
import { Store } from '../../../@core/services';

@Injectable({
	providedIn: 'root'
})
export class EditOrganizationResolver implements Resolve<Observable<IOrganization | Observable<never>>> {
	constructor(
		private readonly organizationsService: OrganizationsService,
		private readonly router: Router,
		private readonly store: Store
	) {}

	resolve(route: ActivatedRouteSnapshot): Observable<IOrganization | Observable<never>> {
		const organizationId = route.params.id;
		if (isEmpty(organizationId)) observableOf(EMPTY);

		const relations = route.firstChild.data.relations || [];
		try {
			return this.organizationsService.getById(organizationId, relations).pipe(
				debounceTime(200),
				tap((organization: IOrganization) => {
					this.store.selectedOrganization = organization;
					this.store.organizationId = organization.id;
				}),
				catchError((error) => observableOf(error))
			);
		} catch (error) {
			this.router.navigate(['/pages/organizations']);
		}
	}
}
