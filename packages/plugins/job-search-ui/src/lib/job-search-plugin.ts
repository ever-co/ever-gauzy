import { PermissionsEnum } from '@gauzy/contracts';
import { PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { JobSearchModule } from './job-search.module';
import { JOB_SEARCH_PAGE_LINK, JOB_SEARCH_PAGE_ROUTE } from './job-search.routes';

/**
 * Job Search (Browse) plugin definition.
 *
 * Registers the /pages/jobs/search route and adds a "Browse" nav item under the Jobs section.
 *
 * @example In plugin-ui.config.ts (as child of JobsPlugin):
 * ```ts
 * plugins: [JobsPlugin.init({
 *   plugins: [JobEmployeePlugin, JobMatchingPlugin, JobSearchPlugin, JobProposalTemplatePlugin]
 * })]
 * ```
 */
export const JobSearchPlugin: PluginUiDefinition = {
	id: 'job-search',
	location: 'jobs-sections',
	module: JobSearchModule,
	permissionKeys: [PermissionsEnum.ORG_JOB_SEARCH],
	routes: [JOB_SEARCH_PAGE_ROUTE as PluginRouteInput],
	navMenu: [
		{
			type: 'section' as const,
			sectionId: 'jobs',
			before: 'jobs-proposal-template',
			items: [
				{
					id: 'jobs-browse',
					title: 'Browse',
					icon: 'fas fa-list',
					link: JOB_SEARCH_PAGE_LINK,
					data: {
						translationKey: 'MENU.JOBS_SEARCH',
						permissionKeys: [PermissionsEnum.ORG_JOB_SEARCH]
					}
				}
			]
		}
	]
};
