import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { debounceTime, EMPTY, Observable, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { IOrganization } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/ui-core/common';
import { AuthService, OrganizationsService, Store } from '@gauzy/ui-core/core';
import { organizationRouteRelations, permissionHolder } from './organization-route-relations';

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
	const _authService = inject(AuthService);

	// Extract organization ID from the route parameters
	const organizationId = route.params.id;

	// If no organization ID is provided, return EMPTY observable
	if (isEmpty(organizationId)) {
		return of(EMPTY);
	}

	// The relations the child route asks for: its `relations`, and its `permittedRelations` the user may load
	const relations$ = organizationRouteRelations(route.firstChild?.data, permissionHolder(_store, _authService));

	// Attempt to fetch the organization details
	return relations$.pipe(
		switchMap((relations: string[]) => _organizationsService.getById(organizationId, relations)),
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
