import { PermissionsEnum } from '@gauzy/contracts';
import { PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { JobMatchingModule } from './job-matching.module';
import { JOB_MATCHING_PAGE_ROUTE } from './job-matching.routes';

/**
 * Job Matching plugin definition.
 *
 * Registers the /pages/jobs/matching route. The "Matching" nav item under the Jobs section
 * is managed dynamically by JobMatchingModule based on the jobMatchingEntity$ observable,
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
export const JobMatchingPlugin: PluginUiDefinition = {
	id: 'job-matching',
	location: 'jobs-sections',
	module: JobMatchingModule,
	permissionKeys: [PermissionsEnum.ORG_JOB_MATCHING_VIEW],
	routes: [JOB_MATCHING_PAGE_ROUTE as PluginRouteInput]
};
