import { PermissionsEnum } from '@gauzy/contracts';
import { PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { JobSearchModule } from './job-search.module';
import { JOB_SEARCH_PAGE_ROUTE } from './job-search.routes';

/**
 * Job Search (Browse) plugin definition.
 *
 * Registers the /pages/jobs/search route. The "Browse" nav item under the Jobs section
 * is managed dynamically by JobSearchModule based on the jobMatchingEntity$ observable,
 * which shows/hides it depending on whether job matching sync is active.
 *
 * @example In plugin-ui.config.ts (as child of JobsPlugin):
 * ```ts
 * plugins: [
 *   JobsPlugin.init({
 *     plugins: [
 *       JobEmployeePlugin,
 *       JobSearchPlugin,
 *       JobMatchingPlugin,
 *       JobProposalTemplatePlugin
 *     ]
 *   })
 * ]
 * ```
 */
export const JobSearchPlugin: PluginUiDefinition = {
	id: 'job-search',
	location: 'jobs-sections',
	module: JobSearchModule,
	permissionKeys: [PermissionsEnum.ORG_JOB_SEARCH],
	routes: [JOB_SEARCH_PAGE_ROUTE as PluginRouteInput]
};
