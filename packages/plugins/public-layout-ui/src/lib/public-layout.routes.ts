import { Route } from '@angular/router';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { NotFoundComponent } from '@gauzy/ui-core/shared';
import { PublicLayoutComponent } from './components/public-layout.component';

/**
 * Creates public layout routes for the application
 *
 * @param _pageRouteRegistryService An instance of PageRouteRegistryService
 * @returns An array of Route objects
 */
export const createPublicLayoutRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Route[] => [
	{
		path: '',
		component: PublicLayoutComponent,
		children: [
			{
				path: '**',
				component: NotFoundComponent
			}
		]
	}
];
