import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { EMPTY, from, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IWarehouse } from '@gauzy/contracts';
import { WarehouseService } from '@gauzy/ui-core/core';

/**
 * Resolver function to fetch warehouse details by ID before route activation.
 *
 * @param route - The activated route snapshot.
 * @returns An observable containing warehouse details or an empty observable on error.
 */
export const WarehouseFormResolver: ResolveFn<Observable<IWarehouse>> = (
	route: ActivatedRouteSnapshot
): Observable<IWarehouse> => {
	// Injecting required services
	const warehouseService = inject(WarehouseService);
	const router = inject(Router);

	// Extract warehouse ID from route parameters
	const warehouseId = route.params['id'];

	// If no warehouse ID is provided, return an empty observable
	if (!warehouseId) {
		return of(null);
	}

	// Fetch warehouse details by ID with relations and handle errors
	return from(warehouseService.getById(warehouseId, ['logo', 'contact', 'tags'])).pipe(
		catchError(() => {
			// Redirect to the warehouses page in case of an error
			router.navigate(['/pages/organization/inventory/warehouses']);
			return EMPTY;
		})
	);
};
