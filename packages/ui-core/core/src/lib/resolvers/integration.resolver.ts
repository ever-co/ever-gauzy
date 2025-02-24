import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
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
			catchError((error) => {
				if (error.status === 403) {
					console.warn('Access to integration is forbidden (403), continuing without integration data.');
					return of(null);
				}
				console.error('Unexpected error in IntegrationResolver:', error);
				return of(null);
			})
		);
	} catch (error) {
		console.error('Unexpected error in IntegrationResolver:', error);
		return of(null);
	}
};
