import { Route } from '@angular/router';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { IntegrationListComponent } from './components/integration-list/list.component';
import { IntegrationsComponent } from './integrations.component';
import { IntegrationLayoutComponent } from './layout/layout.component';

/**
 * Create and configures routes for the integrations module.
 *
 * @param _pageRouteRegistryService
 * @returns
 */
export const createIntegrationsRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Route[] => [
	{
		path: '',
		component: IntegrationLayoutComponent,
		children: [
			{
				path: '',
				component: IntegrationListComponent,
				data: {
					selectors: {
						project: false,
						team: false,
						employee: false,
						date: false,
						organization: true
					}
				}
			},
			{
				path: 'new',
				component: IntegrationsComponent,
				data: {
					selectors: {
						project: false,
						team: false,
						employee: false,
						date: false,
						organization: false
					}
				}
			}
		]
	},
	..._pageRouteRegistryService.getPageLocationRoutes('integrations')
];
