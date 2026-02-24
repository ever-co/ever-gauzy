import { Route } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryConfig, PermissionsGuard } from '@gauzy/ui-core/core';
import { UpworkComponent } from './components/upwork/upwork.component';
import { UpworkAuthorizeComponent } from './components/upwork-authorize/upwork-authorize.component';
import { TransactionsComponent } from './components/transactions/transactions.component';
import { ContractsComponent } from './components/contracts/contracts.component';
import { ReportsComponent } from './components/reports/reports.component';
import { IntegrationUpworkLayoutComponent } from './integration-upwork.layout.component';

/** Path for the upwork integration section under /pages/integrations. */
export const INTEGRATION_UPWORK_PATH = 'upwork';

/** Full path for the upwork integration page. */
export const INTEGRATION_UPWORK_PAGE_LINK = `/pages/integrations/${INTEGRATION_UPWORK_PATH}`;

/**
 * Route config for registering the upwork integration section at integrations-sections.
 * Used by IntegrationUpworkPlugin for declarative route registration.
 */
export const INTEGRATION_UPWORK_PAGE_ROUTE: PageRouteRegistryConfig = {
	location: 'integrations-sections',
	path: INTEGRATION_UPWORK_PATH,
	loadChildren: () => import('./integration-upwork-ui.module').then((m) => m.IntegrationUpworkUiModule),
	data: {
		permissions: {
			only: [PermissionsEnum.INTEGRATION_VIEW],
			redirectTo: '/pages/integrations'
		}
	}
};

/**
 * Returns the routes for the upwork integration section.
 *
 * @returns Route array for the ROUTES provider in IntegrationUpworkUiModule
 */
export function getUpworkRoutes(): Route[] {
	return [
		{
			path: '',
			component: IntegrationUpworkLayoutComponent,
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
					component: UpworkAuthorizeComponent,
					data: { state: true }
				},
				{
					path: 'regenerate',
					component: UpworkAuthorizeComponent,
					data: { state: false }
				},
				{
					path: ':id',
					component: UpworkComponent,
					children: [
						{
							path: '',
							redirectTo: 'contracts',
							pathMatch: 'full'
						},
						{
							path: 'activities',
							component: TransactionsComponent
						},
						{
							path: 'reports',
							component: ReportsComponent,
							data: { selectors: { project: false } }
						},
						{
							// both 'activities' and 'transactions' map to the same component
							// (TransactionsComponent) intentionally; this provides a
							// terminology alias/backwards-compatibility for users and
							// keeps link naming consistent in the UI even if the underlying
							// view hasn't changed.
							path: 'transactions',
							component: TransactionsComponent
						},
						{
							path: 'contracts',
							component: ContractsComponent
						}
					]
				},
				{
					path: ':id/settings',
					loadChildren: () => import('@gauzy/ui-core/shared').then((m) => m.WorkInProgressModule)
				}
			]
		}
	];
}
