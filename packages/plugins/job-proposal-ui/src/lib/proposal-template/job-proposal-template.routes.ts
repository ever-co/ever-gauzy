import { Route } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryService, PermissionsGuard } from '@gauzy/ui-core/core';
import { ProposalTemplateComponent } from './components/proposal-template/proposal-template.component';

/**
 * Creates jobs proposal template routes for the application
 *
 * @param _pageRouteRegistryService An instance of PageRouteRegistryService
 * @returns An array of Route objects
 */
export const createJobProposalTemplateRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Route[] => [
	{
		path: '',
		component: ProposalTemplateComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW],
				redirectTo: '/pages/jobs/search'
			}
		}
	}
];
