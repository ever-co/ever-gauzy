import { Route } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryService, PermissionsGuard } from '@gauzy/ui-core/core';
import { DateRangePickerResolver } from '@gauzy/ui-core/shared';
import {
	ProposalDetailsComponent,
	ProposalEditComponent,
	ProposalLayoutComponent,
	ProposalRegisterComponent
} from './components';
import { ProposalDetailsResolver } from './resolvers/proposal-details.resolver';

/**
 * Redirects to the dashboard page
 *
 * @returns
 */
export function redirectTo() {
	return '/pages/dashboard';
}

/**
 * Creates jobs proposal routes for the application
 *
 * @param _pageRouteRegistryService An instance of PageRouteRegistryService
 * @returns An array of Route objects
 */
export const createJobProposalRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Route[] => [
	{
		path: '',
		component: ProposalLayoutComponent,
		children: [
			{
				path: 'register',
				component: ProposalRegisterComponent,
				canActivate: [PermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.ORG_PROPOSALS_EDIT],
						redirectTo
					},
					selectors: {
						employee: false,
						project: false,
						team: false
					},
					datePicker: { unitOfTime: 'month' }
				},
				resolve: { dates: DateRangePickerResolver }
			},
			{
				path: 'details/:id',
				component: ProposalDetailsComponent,
				canActivate: [PermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.ORG_PROPOSALS_VIEW],
						redirectTo
					},
					selectors: false
				},
				resolve: { proposal: ProposalDetailsResolver }
			},
			{
				path: 'edit/:id',
				component: ProposalEditComponent,
				canActivate: [PermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.ORG_PROPOSALS_EDIT],
						redirectTo
					},
					selectors: false
				},
				resolve: { proposal: ProposalDetailsResolver }
			},
			..._pageRouteRegistryService.getPageLocationRoutes('proposals')
		]
	}
];
