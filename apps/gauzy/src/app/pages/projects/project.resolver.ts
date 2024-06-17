import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { EMPTY, Observable, catchError, of } from 'rxjs';
import { IOrganizationProject } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/ui-core/common';
import { OrganizationProjectsService } from '@gauzy/ui-core/core';

@Injectable({
	providedIn: 'root'
})
export class ProjectResolver implements Resolve<Observable<IOrganizationProject | Observable<never>>> {
	/**
	 * Constructs the ProjectResolver.
	 * @param _organizationProjectsService The organization projects service used to fetch project details.
	 * @param router The router service for navigation.
	 */
	constructor(
		private readonly _organizationProjectsService: OrganizationProjectsService,
		private readonly router: Router
	) {}

	/**
	 * Resolves project details before activating a specific route.
	 * @param route The activated route snapshot.
	 * @returns An observable containing project details or an empty observable.
	 */
	resolve(route: ActivatedRouteSnapshot): Observable<IOrganizationProject | Observable<never>> {
		const projectId = route.params.id;

		if (isEmpty(projectId)) {
			return of(EMPTY);
		}

		try {
			const relations = route.firstChild.data.relations || [];
			return this._organizationProjectsService.getById(projectId, relations).pipe(
				catchError(() => {
					this.router.navigate(['/pages/organization/projects']);
					return EMPTY;
				})
			);
		} catch (error) {
			this.router.navigate(['/pages/organization/projects']);
		}
	}
}
