import { PermissionsEnum } from '@gauzy/contracts';
import { PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { JobProposalTemplateModule } from './job-proposal-template.module';
import { JOB_PROPOSAL_TEMPLATE_PAGE_LINK, JOB_PROPOSAL_TEMPLATE_PAGE_ROUTE } from './job-proposal-template.routes';

/**
 * Job Proposal Template plugin definition.
 *
 * Registers the /pages/jobs/proposal-template route and adds a "Proposal Template" nav item under the Jobs section.
 *
 * @example In plugin-ui.config.ts (as child of JobsPlugin):
 * ```ts
 * plugins: [JobsPlugin.init({
 *   plugins: [JobEmployeePlugin, JobMatchingPlugin, JobSearchPlugin, JobProposalTemplatePlugin]
 * })]
 * ```
 */
export const JobProposalTemplatePlugin: PluginUiDefinition = {
	id: 'job-proposal-template',
	location: 'jobs-sections',
	module: JobProposalTemplateModule,
	permissionKeys: [PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW],
	routes: [JOB_PROPOSAL_TEMPLATE_PAGE_ROUTE as PluginRouteInput],
	navMenu: [
		{
			sectionId: 'jobs',
			items: [
				{
					id: 'jobs-proposal-template',
					title: 'Proposal Template',
					icon: 'far fa-file-alt',
					link: JOB_PROPOSAL_TEMPLATE_PAGE_LINK,
					data: {
						translationKey: 'MENU.PROPOSAL_TEMPLATE',
						permissionKeys: [PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW],
						add: '/pages/jobs/proposal-template?openAddDialog=true'
					}
				}
			]
		}
	]
};
