import { Route } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PluginRouteInput } from '@gauzy/plugin-ui';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { EverAsyncConnectComponent } from './components/ever-async-connect/ever-async-connect.component';
import { IntegrationEverAsyncLayoutComponent } from './integration-ever-async.layout.component';

/** Path for the Ever Async integration section under /pages/integrations. */
export const INTEGRATION_EVER_ASYNC_PATH = 'ever-async';

/** Full path for the Ever Async integration page. */
export const INTEGRATION_EVER_ASYNC_PAGE_LINK = `/pages/integrations/${INTEGRATION_EVER_ASYNC_PATH}`;

/**
 * Route config for registering the Ever Async integration section at integrations-sections.
 * Used by IntegrationEverAsyncPlugin for declarative route registration.
 */
export const INTEGRATION_EVER_ASYNC_PAGE_ROUTE: PluginRouteInput = {
	location: 'integrations-sections',
	path: INTEGRATION_EVER_ASYNC_PATH,
	loadChildren: () => import('./integration-ever-async-ui.module').then((m) => m.IntegrationEverAsyncUiModule),
	data: {
		permissions: {
			only: [PermissionsEnum.INTEGRATION_VIEW],
			redirectTo: '/pages/integrations'
		}
	}
};

/**
 * Returns the routes for the Ever Async integration section.
 *
 * @returns Route array for the ROUTES provider in IntegrationEverAsyncUiModule
 */
export function getEverAsyncRoutes(): Route[] {
	return [
		{
			path: '',
			component: IntegrationEverAsyncLayoutComponent,
			canActivate: [PermissionsGuard],
			data: {
				permissions: {
					only: [PermissionsEnum.INTEGRATION_VIEW],
					redirectTo: '/pages/integrations'
				}
			},
			children: [
				{
					path: '',
					component: EverAsyncConnectComponent
				}
			]
		}
	];
}
