import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, ResolveFn } from '@angular/router';
import { Observable, EMPTY, map } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IIntegrationEntitySetting, IPagination } from '@gauzy/contracts';
import { IntegrationEntitySettingService } from '@gauzy/ui-core/core';

/**
 * Resolver function to fetch integration entity settings before activating a route.
 *
 * @param route - The activated route snapshot.
 * @returns An observable that emits integration entity settings or an empty observable on error.
 */
export const IntegrationEntitySettingResolver: ResolveFn<Observable<IIntegrationEntitySetting[] | never>> = (
	route: ActivatedRouteSnapshot
): Observable<IIntegrationEntitySetting[] | never> => {
	// Injecting required services
	const _router = inject(Router);
	const _integrationEntitySettingService = inject(IntegrationEntitySettingService);

	// Extract integration ID from the route parameters
	const integrationId = route.paramMap.get('id');

	// Fetch integration entity settings and handle potential errors
	return _integrationEntitySettingService.getEntitySettings(integrationId).pipe(
		map(({ items }: IPagination<IIntegrationEntitySetting>) => items),
		catchError((error: any) => {
			// Navigate to the new integration page in case of an error
			_router.navigate(['/pages/integrations/new']);
			// Log the error for debugging purposes
			console.error('Error while fetching integration entity settings:', error);
			// Return EMPTY observable to indicate a resolution failure
			return EMPTY;
		})
	);
};
