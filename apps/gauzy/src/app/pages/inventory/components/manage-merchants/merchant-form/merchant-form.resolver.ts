import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, EMPTY, from, Observable } from 'rxjs';
import { IMerchant } from '@gauzy/contracts';
import { MerchantService } from '@gauzy/ui-core/core';

/**
 * Resolver function to fetch merchant details by ID.
 * If an error occurs, the user is redirected to the merchants page.
 *
 * @param route - The activated route snapshot containing the route parameters.
 * @returns An observable that emits the merchant details or an empty observable on error.
 */
export const MerchantFormResolver: ResolveFn<Observable<IMerchant>> = (
	route: ActivatedRouteSnapshot
): Observable<IMerchant> => {
	// Inject necessary services
	const _router = inject(Router);
	const _merchantService = inject(MerchantService);

	// Extract merchant ID from route parameters
	const merchantId = route.params['id'];

	// If no merchant ID is provided, return an empty observable
	if (!merchantId) {
		return EMPTY;
	}

	// If no merchant ID is provided, return an empty observable
	const merchant$ = _merchantService.getById(merchantId, ['logo', 'contact', 'warehouses', 'tags']);

	// Attempt to fetch merchant details
	return from(merchant$).pipe(
		catchError((error) => {
			// Navigate to the merchants page in case of an error
			_router.navigate(['/pages/organization/inventory/merchants']);
			// Log the error for debugging purposes
			console.error('Error while fetching merchant details:', error);
			// Return EMPTY observable
			return EMPTY;
		})
	);
};
