import { Route } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PluginRouteInput } from '@gauzy/plugin-ui';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { PlaneAuthorizeComponent } from './components/plane-authorize/plane-authorize.component';
import { PlaneSettingsComponent } from './components/plane-settings/plane-settings.component';
import { IntegrationPlaneLayoutComponent } from './integration-plane.layout.component';

/** Path for the plane integration section under /pages/integrations. */
export const INTEGRATION_PLANE_PATH = 'plane';

/** Full path for the plane integration page. */
export const INTEGRATION_PLANE_PAGE_LINK = `/pages/integrations/${INTEGRATION_PLANE_PATH}`;

/**
 * Route config for registering the plane integration section at integrations-sections.
 * Used by IntegrationPlanePlugin for declarative route registration.
 */
export const INTEGRATION_PLANE_PAGE_ROUTE: PluginRouteInput = {
	location: 'integrations-sections',
	path: INTEGRATION_PLANE_PATH,
	loadChildren: () => import('./integration-plane-ui.module').then((m) => m.IntegrationPlaneUiModule),
	data: {
		permissions: {
			only: [PermissionsEnum.INTEGRATION_VIEW],
			redirectTo: '/pages/integrations'
		}
	}
};

/**
 * Returns the routes for the plane integration section.
 *
 * @returns Route array for the ROUTES provider in IntegrationPlaneUiModule
 */
export function getPlaneRoutes(): Route[] {
	return [
		{
			path: '',
			component: IntegrationPlaneLayoutComponent,
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
					component: PlaneAuthorizeComponent,
					data: { state: true }
				},
				{
					path: 'regenerate',
					component: PlaneAuthorizeComponent,
					data: { state: false }
				},
				{
					path: ':id',
					component: PlaneSettingsComponent
				}
			]
		}
	];
}
