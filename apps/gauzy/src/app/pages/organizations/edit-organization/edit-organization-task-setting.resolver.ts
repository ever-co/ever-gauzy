import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { catchError, EMPTY, Observable, of } from 'rxjs';
import { IOrganizationTaskSetting } from '@gauzy/contracts';
import { OrganizationTaskSettingService, Store } from '@gauzy/ui-core/core';
import { isEmpty } from '@gauzy/ui-core/common';

/**
 * Resolver function to fetch organization task settings by organization ID.
 * If an error occurs, the user is redirected to the organizations page.
 *
 * @param route - The activated route snapshot containing the route parameters.
 * @returns An observable that emits the organization task settings or an empty observable on error.
 */
export const EditOrganizationTaskSettingResolver: ResolveFn<
	Observable<IOrganizationTaskSetting | Observable<never>>
> = (route: ActivatedRouteSnapshot): Observable<IOrganizationTaskSetting | Observable<never>> => {
	// Inject necessary services
	const _router = inject(Router);
	const _store = inject(Store);
	const _organizationTaskSettingService = inject(OrganizationTaskSettingService);

	// Extract organization ID from route parameters
	const organizationId = route.params['id'];

	// If no organization ID is provided, return an empty observable
	if (isEmpty(organizationId)) {
		return of(EMPTY);
	}

	// Get tenant ID from the selected organization in the store
	const { tenantId } = _store.selectedOrganization;

	// Attempt to fetch organization task settings
	return _organizationTaskSettingService.getByOrganization({ organizationId, tenantId }).pipe(
		catchError(() => {
			// Navigate to the organizations page in case of an error
			_router.navigate(['/pages/organizations']);
			// Return EMPTY observable
			return EMPTY;
		})
	);
};
