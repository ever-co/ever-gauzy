import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot, Router } from '@angular/router';
import { Observable, EMPTY, map } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IIntegrationSetting, IIntegrationTenant } from '@gauzy/contracts';
import { IntegrationsService } from '@gauzy/ui-core/core';

@Injectable({
	providedIn: 'root'
})
export class IntegrationSettingResolver implements Resolve<Observable<IIntegrationSetting[] | boolean>> {
	constructor(private readonly _router: Router, private readonly _integrationsService: IntegrationsService) {}

	/**
	 * Resolves integration settings before activating the route.
	 *
	 * @param route - The activated route snapshot.
	 * @returns An observable that emits integration settings or a boolean value.
	 */
	resolve(route: ActivatedRouteSnapshot): Observable<IIntegrationSetting[] | boolean> {
		try {
			const integrationId = route.paramMap.get('id');

			return this._integrationsService.getIntegrationTenant(integrationId, { relations: ['settings'] }).pipe(
				map(({ settings }: IIntegrationTenant) => settings),
				catchError((error: any) => {
					// Navigate to the new integration page in case of an error
					this._router.navigate(['/pages/integrations/new']);
					// Log the error for debugging purposes
					console.error('Error while fetching integration settings:', error);
					// Returning EMPTY as a placeholder; adjust this based on your needs
					return EMPTY;
				})
			);
		} catch (error) {
			// Handle synchronous errors (if any)
			console.error('Error in IntegrationSettingsResolver:', error);
			// Navigate to the new integration page in case of an error
			this._router.navigate(['/pages/integrations/new']);
			// Returning EMPTY as a placeholder; adjust this based on your needs
			return EMPTY;
		}
	}
}
