import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot, Router } from '@angular/router';
import { EMPTY, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IOrganization } from '@gauzy/contracts';
import { ErrorHandlingService, OrganizationsService } from '@gauzy/ui-sdk/core';

@Injectable({
	providedIn: 'root'
})
export class PublicOrganizationResolver implements Resolve<any> {
	constructor(
		private readonly organizationsService: OrganizationsService,
		private readonly router: Router,
		private readonly errorHandlingService: ErrorHandlingService
	) {}

	/**
	 *
	 * @param route
	 * @returns
	 */
	resolve(route: ActivatedRouteSnapshot): Observable<IOrganization> {
		try {
			const profileLink = route.params.profileLink;
			const organizationId = route.params.organizationId;
			const relations = route.data.relations || [];

			return this.organizationsService.getByProfileLink(profileLink, organizationId, [...relations]).pipe(
				catchError((error) => {
					this.errorHandlingService.handleError(error);
					this.router.navigateByUrl('/');
					return EMPTY;
				})
			);
		} catch (error) {
			this.router.navigateByUrl('/');
		}
	}
}
