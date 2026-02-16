import { PermissionsEnum } from '@gauzy/contracts';
import { PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { JobMatchingModule } from './job-matching.module';
import { JOB_MATCHING_PAGE_LINK, JOB_MATCHING_PAGE_ROUTE } from './job-matching.routes';

/**
 * Job Matching plugin definition.
 *
 * Registers the /pages/jobs/matching route and adds a "Matching" nav item under the Jobs section.
 *
 * @example In plugin-ui.config.ts (as child of JobsPlugin):
 * ```ts
 * plugins: [JobsPlugin.init({
 *   plugins: [JobEmployeePlugin, JobMatchingPlugin, JobSearchPlugin, JobProposalTemplatePlugin]
 * })]
 * ```
 */
export const JobMatchingPlugin: PluginUiDefinition = {
	id: 'job-matching',
	location: 'jobs-sections',
	module: JobMatchingModule,
	permissionKeys: [PermissionsEnum.ORG_JOB_MATCHING_VIEW],
	routes: [JOB_MATCHING_PAGE_ROUTE as PluginRouteInput],
	navMenu: [
		{
			type: 'section' as const,
			sectionId: 'jobs',
			before: 'jobs-proposal-template',
			items: [
				{
					id: 'jobs-matching',
					title: 'Matching',
					icon: 'fas fa-user',
					link: JOB_MATCHING_PAGE_LINK,
					data: {
						translationKey: 'MENU.JOBS_MATCHING',
						permissionKeys: [PermissionsEnum.ORG_JOB_MATCHING_VIEW]
					}
				}
			]
		}
	]
};
