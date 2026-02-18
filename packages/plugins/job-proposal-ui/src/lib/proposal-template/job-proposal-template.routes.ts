import { Route } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryConfig, PermissionsGuard } from '@gauzy/ui-core/core';
import { ProposalTemplateListComponent } from './components/proposal-template-list/proposal-template-list.component';

/** Path for the job proposal template tab under /pages/jobs. */
export const JOB_PROPOSAL_TEMPLATE_PATH = 'proposal-template';

/** Full path for the job proposal template page. */
export const JOB_PROPOSAL_TEMPLATE_PAGE_LINK = `/pages/jobs/${JOB_PROPOSAL_TEMPLATE_PATH}`;

/** Route data selectors for the job proposal template page. */
const JOB_PROPOSAL_TEMPLATE_SELECTORS = {
	project: false,
	team: false
} as const;

/**
 * Route config for registering the job proposal template section at jobs-sections.
 * Used by JobProposalTemplatePlugin for declarative route registration.
 */
export const JOB_PROPOSAL_TEMPLATE_PAGE_ROUTE: PageRouteRegistryConfig = {
	location: 'jobs-sections',
	path: JOB_PROPOSAL_TEMPLATE_PATH,
	loadChildren: () => import('./job-proposal-template.module').then((m) => m.JobProposalTemplateModule),
	data: { selectors: { ...JOB_PROPOSAL_TEMPLATE_SELECTORS } }
};

/**
 * Returns the routes for the job proposal template section.
 *
 * @returns Route array for the ROUTES provider in JobProposalTemplateModule
 */
export function getJobProposalTemplateRoutes(): Route[] {
	return [
		{
			path: '',
			component: ProposalTemplateListComponent,
			canActivate: [PermissionsGuard],
			data: {
				permissions: {
					only: [PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW],
					redirectTo: '/pages/jobs/search'
				}
			}
		}
	];
}
