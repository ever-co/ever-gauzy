import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Observable, catchError, from, of } from 'rxjs';
import { IDeal } from '@gauzy/contracts';
import { DealsService, ErrorHandlingService, Store } from '@gauzy/ui-core/core';

/**
 * Resolver function to fetch a deal by its ID.
 *
 * @param route The activated route snapshot containing the route parameters.
 * @returns An observable of IDeal or null if no dealId is present.
 */
export const DealResolver: ResolveFn<Observable<IDeal>> = (route) => {
	const store = inject(Store);
	const dealsService = inject(DealsService);
	const errorHandlingService = inject(ErrorHandlingService);

	// Extract deal ID from route parameters
	const dealId = route.params['dealId'];

	// If deal ID is not present, return null
	if (!dealId) {
		return of(null);
	}

	// Extract organization ID and tenant ID from store
	const { id: organizationId, tenantId } = store.selectedOrganization;

	// Fetch deal by ID from the service
	return from(dealsService.getById(dealId, { organizationId, tenantId }, ['client'])).pipe(
		catchError((error) => {
			// Handle and log errors
			errorHandlingService.handleError(error);
			// Return null on error
			return of(error);
		})
	);
};
