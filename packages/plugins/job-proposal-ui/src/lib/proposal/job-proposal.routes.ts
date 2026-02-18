import { Route } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryConfig, PageRouteRegistryService, PermissionsGuard } from '@gauzy/ui-core/core';
import { DateRangePickerResolver } from '@gauzy/ui-core/shared';
import {
	ProposalComponent,
	ProposalDetailsComponent,
	ProposalEditComponent,
	ProposalRegisterComponent
} from './components';
import { ProposalLayoutComponent } from './components/proposal-layout.component';
import { ProposalDetailsResolver } from './proposal-details.resolver';

/** Location where the proposals route is registered under Sales (path: 'proposals'). */
export const SALES_SECTIONS_LOCATION = 'sales-sections';

/** Location where additional proposal child routes can be registered by other plugins. */
export const PROPOSALS_SECTIONS_LOCATION = 'proposals-sections';

/** Full path for the proposals page under Sales. */
export const JOB_PROPOSAL_PAGE_LINK = '/pages/sales/proposals';

/** Redirect path when user lacks proposal permissions. */
const PROPOSAL_REDIRECT = '/pages/dashboard';

/** Base selectors for proposal list. */
const PROPOSAL_LIST_SELECTORS = { project: false, team: false } as const;

/** Selectors for proposal register. */
const PROPOSAL_REGISTER_SELECTORS = { employee: false, project: false, team: false } as const;

/**
 * Route config for registering proposals under Sales.
 * Includes the full route tree: path 'proposals' with loadChildren, and the loaded
 * module provides the layout with child routes (list, register, details, edit).
 */
export const JOB_PROPOSAL_SALES_ROUTE: PageRouteRegistryConfig = {
	location: SALES_SECTIONS_LOCATION,
	path: 'proposals',
	loadChildren: () => import('./job-proposal.module').then((m) => m.JobProposalModule)
};

/**
 * Returns the routes for the proposals section.
 * Uses ProposalLayoutComponent as parent with static child routes merged with
 * any additional routes registered at proposals-sections by other plugins.
 *
 * @param registry Page route registry to fetch extra child routes from proposals-sections
 * @returns Route array for the ROUTES provider in JobProposalModule
 */
export function getProposalsRoutes(pageRouteRegistryService: PageRouteRegistryService): Route[] {
	return [
		{
			path: '',
			component: ProposalLayoutComponent,
			children: [
				{
					path: '',
					pathMatch: 'full',
					component: ProposalComponent,
					canActivate: [PermissionsGuard],
					data: { selectors: { ...PROPOSAL_LIST_SELECTORS }, datePicker: { unitOfTime: 'month' } },
					resolve: { dates: DateRangePickerResolver }
				},
				{
					path: 'register',
					component: ProposalRegisterComponent,
					canActivate: [PermissionsGuard],
					data: {
						permissions: { only: [PermissionsEnum.ORG_PROPOSALS_EDIT], redirectTo: PROPOSAL_REDIRECT },
						selectors: { ...PROPOSAL_REGISTER_SELECTORS },
						datePicker: { unitOfTime: 'month' }
					},
					resolve: { dates: DateRangePickerResolver }
				},
				{
					path: 'details/:id',
					component: ProposalDetailsComponent,
					canActivate: [PermissionsGuard],
					data: {
						permissions: { only: [PermissionsEnum.ORG_PROPOSALS_VIEW], redirectTo: PROPOSAL_REDIRECT },
						selectors: false
					},
					resolve: { proposal: ProposalDetailsResolver }
				},
				{
					path: 'edit/:id',
					component: ProposalEditComponent,
					canActivate: [PermissionsGuard],
					data: {
						permissions: { only: [PermissionsEnum.ORG_PROPOSALS_EDIT], redirectTo: PROPOSAL_REDIRECT },
						selectors: false
					},
					resolve: { proposal: ProposalDetailsResolver }
				},
				...pageRouteRegistryService.getPageLocationRoutes(PROPOSALS_SECTIONS_LOCATION)
			]
		}
	];
}
