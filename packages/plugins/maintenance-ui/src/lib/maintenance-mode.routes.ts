import { Route } from '@angular/router';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { MaintenanceModeComponent } from './maintenance-mode.component';

/**
 * Creates the routes for the maintenance mode plugin.
 *
 * @param _pageRouteRegistryService An instance of PageRouteRegistryService
 * @returns An array of Route objects
 */
export const createMaintenanceRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Route[] => [
	{
		path: '',
		component: MaintenanceModeComponent
	}
];
