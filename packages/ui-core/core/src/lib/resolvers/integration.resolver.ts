import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { catchError, EMPTY, Observable, of } from 'rxjs';
import { IIntegrationTenant } from '@gauzy/contracts';
import { IntegrationsService, Store } from '../services';

/**
 * Resolver function to fetch integration tenant details before activating a specific route.
 *
 * @param route - The activated route snapshot.
 * @returns An observable containing integration tenant details or an empty observable on error.
 */
export const IntegrationResolver: ResolveFn<Observable<IIntegrationTenant | boolean>> = (
	route: ActivatedRouteSnapshot
): Observable<IIntegrationTenant | boolean> => {
	// Inject the required services
	const _router = inject(Router);
	const _integrationsService = inject(IntegrationsService);
	const _store = inject(Store);

	try {
		// Get Integration name and relations from route data
		const name = route.data.integration;
		const relations = route.data.relations || [];

		// Extract organization ID and tenant ID from store
		const { id: organizationId, tenantId } = _store.selectedOrganization;

		if (!organizationId) {
			// Return null if organization ID is missing
			return of(null);
		}

		// Fetch integration details by options
		const integration$ = _integrationsService.getIntegrationByOptions({
			organizationId,
			tenantId,
			name,
			relations
		});

		// Handle errors and redirect if an error occurs
		return integration$.pipe(
			catchError(() => {
				// Redirect to the "new integration" page if an error occurs
				_router.navigate(['/pages/integrations/new']);
				// Return an empty observable to prevent further actions
				return EMPTY;
			})
		);
	} catch (error) {
		// Handle any synchronous errors and redirect to "new integration" page
		_router.navigate(['/pages/integrations/new']);
		// Return an empty observable
		return EMPTY;
	}
};
