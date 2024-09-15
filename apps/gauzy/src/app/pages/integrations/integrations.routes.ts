import { Route } from '@angular/router';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { IntegrationLayoutComponent } from './layout/layout.component';
import { IntegrationsComponent } from './integrations.component';
import { IntegrationListComponent } from './components/integration-list/list.component';

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
