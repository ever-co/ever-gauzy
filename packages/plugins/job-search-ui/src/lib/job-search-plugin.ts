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
 *       JobProposalPlugin,
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

	// ── Versioning & Compatibility ────────────────────────────────
	version: '1.0.0',

	// ── Location & Module ────────────────────────────────────────
	location: 'jobs-sections',
	module: JobSearchModule,

	// ── Access Control ───────────────────────────────────────────
	permissionKeys: [PermissionsEnum.ORG_JOB_SEARCH],

	// ── Routes ───────────────────────────────────────────────────
	routes: [JOB_SEARCH_PAGE_ROUTE as PluginRouteInput]
};
