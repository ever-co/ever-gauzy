import { inject } from '@angular/core';
import { ResolveFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { catchError, EMPTY, Observable } from 'rxjs';
import { IOrganization } from '@gauzy/contracts';
import { ErrorHandlingService, OrganizationsService } from '@gauzy/ui-core/core';

/**
 * Resolves the organization data before activating the route.
 *
 * This resolver function is used to fetch the organization data by its profile link
 * and ID before the route is activated. In case of an error during data retrieval,
 * it handles the error by redirecting to the home page and logging the error.
 *
 * @param route The ActivatedRouteSnapshot containing route parameters, including
 *              the profile link and organization ID.
 * @returns An observable of the resolved IOrganization object. In case of an error,
 *          it returns an empty observable and navigates to the home page.
 */
export const PublicOrganizationResolver: ResolveFn<Observable<IOrganization>> = (
	route: ActivatedRouteSnapshot
): Observable<IOrganization> => {
	// Inject the necessary services
	const _organizationsService = inject(OrganizationsService);
	const _router = inject(Router);
	const _errorHandlingService = inject(ErrorHandlingService);

	// Extract the route parameters
	const { profileLink, organizationId } = route.params;

	// Check if the organization ID is present
	if (!organizationId || !profileLink) {
		return EMPTY;
	}

	// Define the relations to be included in the response
	const relations = route.data?.relations || [];

	// Get the organization by its profile link and ID
	return _organizationsService.getByProfileLink(profileLink, organizationId, relations).pipe(
		catchError((error) => {
			// Log the error
			_errorHandlingService.handleError(error);
			// Navigate to the home page
			_router.navigateByUrl('/');
			// Return an empty observable to prevent further actions
			return EMPTY;
		})
	);
};
