import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { inject } from '@angular/core';
import { IOrganization } from '@gauzy/contracts';
import { OrganizationsService } from '../services';

/**
 * Resolver function to fetch the employee count for the given organization.
 *
 * @param route - The activated route snapshot.
 * @returns An observable of the employee count or 0 in case of an error or missing organization ID.
 */
export const EmployeeCountResolver: ResolveFn<Observable<number>> = (
	route: ActivatedRouteSnapshot
): Observable<number> => {
	// Inject the OrganizationsService
	const _organizationsService = inject(OrganizationsService);

	// Extract the organization ID from route parameters
	const organizationId = route.params['id'];

	// Return 0 if organization ID is missing
	if (!organizationId) {
		// Return 0 if organization ID is missing
		return of(0);
	}

	// Fetch organization details from the API
	const organization$ = _organizationsService.getById(organizationId, [], {
		id: true,
		totalEmployees: true
	});

	// Fetch organization details and map to employee count
	return organization$.pipe(
		map((organization: IOrganization) => organization?.totalEmployees ?? 0),
		catchError(() => of(0)) // Return 0 on error
	);
};
