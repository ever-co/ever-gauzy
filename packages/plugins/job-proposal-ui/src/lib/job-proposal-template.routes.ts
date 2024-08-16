import { Route } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageRegistryService, PermissionsGuard } from '@gauzy/ui-core/core';
import { ProposalTemplateComponent } from './components/proposal-template/proposal-template.component';

/**
 * Creates jobs proposal template routes for the application
 *
 * @param _pageRegistryService An instance of PageRegistryService
 * @returns An array of Route objects
 */
export const createRoutes = (_pageRegistryService: PageRegistryService): Route[] => [
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
