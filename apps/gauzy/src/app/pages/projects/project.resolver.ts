import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { EMPTY, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IOrganizationProject } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/ui-core/common';
import { OrganizationProjectsService } from '@gauzy/ui-core/core';

/**
 * Resolver function to fetch project details before route activation.
 *
 * @param route - The activated route snapshot.
 * @returns An observable containing project details or an empty observable on error.
 */
export const ProjectResolver: ResolveFn<Observable<IOrganizationProject | Observable<never>>> = (
	route: ActivatedRouteSnapshot
): Observable<IOrganizationProject | Observable<never>> => {
	// Inject necessary services
	const _organizationProjectsService = inject(OrganizationProjectsService);
	const _router = inject(Router);

	// Extract the project ID from the route parameters
	const projectId = route.params['id'];

	// If no project ID is provided, return an empty observable
	if (isEmpty(projectId)) {
		return of(EMPTY);
	}

	// Extract relations if available from route data
	const relations = route.firstChild?.data['relations'] || [];

	// Fetch the project details by ID and handle errors
	return _organizationProjectsService.getById(projectId, relations).pipe(
		catchError(() => {
			// Navigate to projects page in case of an error
			_router.navigate(['/pages/organization/projects']);
			return EMPTY;
		})
	);
};
