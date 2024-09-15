import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { debounceTime, EMPTY, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { IOrganization } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/ui-core/common';
import { OrganizationsService, Store } from '@gauzy/ui-core/core';

/**
 * Resolver function to fetch organization details before activating the route.
 *
 * @param route - The activated route snapshot.
 * @returns An observable that emits organization details or an empty observable on error.
 */
export const OrganizationResolver: ResolveFn<Observable<IOrganization | Observable<never>>> = (
	route: ActivatedRouteSnapshot
): Observable<IOrganization | Observable<never>> => {
	// Inject necessary services
	const _router = inject(Router);
	const _store = inject(Store);
	const _organizationsService = inject(OrganizationsService);

	// Extract organization ID from the route parameters
	const organizationId = route.params.id;

	// If no organization ID is provided, return EMPTY observable
	if (isEmpty(organizationId)) {
		return of(EMPTY);
	}

	// Extract relations data if available
	const relations = route.firstChild?.data?.relations || [];

	// Attempt to fetch the organization details
	return _organizationsService.getById(organizationId, relations).pipe(
		// Debounce the request to avoid excessive API calls
		debounceTime(200),
		// Update the selected organization and organizationId in the store
		tap((organization: IOrganization) => {
			// Update the selected organization and organizationId in the store
			_store.selectedOrganization = organization;
			_store.organizationId = organization.id;
		}),
		// Handle errors
		catchError((error) => {
			// Log the error and return EMPTY observable
			console.error('Error fetching organization details:', error);
			// Navigate to organizations page on error
			_router.navigate(['/pages/organizations']);
			// Return EMPTY observable to prevent further actions
			return of(EMPTY);
		})
	);
};
