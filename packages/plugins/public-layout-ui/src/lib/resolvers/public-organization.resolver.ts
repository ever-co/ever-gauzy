import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot, Router } from '@angular/router';
import { EMPTY, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IOrganization } from '@gauzy/contracts';
import { ErrorHandlingService, OrganizationsService } from '@gauzy/ui-core/core';

@Injectable({
	providedIn: 'root'
})
export class PublicOrganizationResolver implements Resolve<any> {
	constructor(
		private readonly _organizationsService: OrganizationsService,
		private readonly _router: Router,
		private readonly _errorHandlingService: ErrorHandlingService
	) {}

	/**
	 * Resolves the organization data before activating the route.
	 *
	 * This method is typically used in route guards to fetch necessary
	 * data before the route is activated. It retrieves the organization
	 * by its profile link and ID, handling any potential errors by
	 * redirecting to the home page if the fetch fails.
	 *
	 * @param route The route snapshot containing route parameters and data.
	 * @returns An observable of the resolved IOrganization object.
	 */
	resolve(route: ActivatedRouteSnapshot): Observable<IOrganization> {
		// Extract the route parameters
		const { profileLink, organizationId } = route.params;
		const relations = route.data.relations || [];

		// Get the organization by its profile link and ID
		return this._organizationsService.getByProfileLink(profileLink, organizationId, relations).pipe(
			catchError((error) => {
				this._errorHandlingService.handleError(error);
				this._router.navigateByUrl('/');
				return EMPTY;
			})
		);
	}
}
