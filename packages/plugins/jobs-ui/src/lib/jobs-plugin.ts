import { FeatureEnum } from '@gauzy/contracts';
import { PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { JobEmployeePlugin } from '@gauzy/plugin-job-employee-ui';
import { JobMatchingPlugin } from '@gauzy/plugin-job-matching-ui';
import { JobSearchPlugin } from '@gauzy/plugin-job-search-ui';
import { JobProposalTemplatePlugin } from '@gauzy/plugin-job-proposal-ui';
import { JobsModule } from './jobs.module';
import { JOBS_PAGE_ROUTE, JOBS_SECTIONS_LOCATION } from './job.routes';

/**
 * Plugin definition for the Jobs plugin group with configurable child plugins.
 */
export interface JobsPluginDefinition extends PluginUiDefinition {
	init(opts: { plugins: PluginUiDefinition[] }): PluginUiDefinition;
}

/**
 * Default jobs plugins.
 */
const DEFAULT_JOBS_PLUGINS: PluginUiDefinition[] = [
	JobEmployeePlugin,
	JobMatchingPlugin,
	JobSearchPlugin,
	JobProposalTemplatePlugin
];

/**
 * Jobs plugin group. Parent module (JobsModule) is initialized first, then
 * child plugins. Child plugins register their routes and nav items under
 * location 'jobs-sections'. The jobs route is defined in pages.routes.ts.
 *
 * Uses imperative registration in JobsModule constructor.
 *
 * @example In plugin-ui.config.ts:
 * ```ts
 * plugins: [JobsPlugin]
 * ```
 *
 * @example Customize child plugins with init:
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
export const JobsPlugin: JobsPluginDefinition = {
	id: 'jobs',
	location: JOBS_SECTIONS_LOCATION,
	module: JobsModule,
	routes: [JOBS_PAGE_ROUTE as PluginRouteInput],
	navMenu: [
		{
			type: 'config' as const,
			config: {
				id: 'jobs',
				title: 'Jobs',
				icon: 'fas fa-briefcase',
				link: '/pages/jobs',
				data: {
					translationKey: 'MENU.JOBS',
					featureKey: FeatureEnum.FEATURE_JOB
				},
				items: []
			},
			before: 'employees'
		}
	],
	featureKey: FeatureEnum.FEATURE_JOB,
	plugins: DEFAULT_JOBS_PLUGINS,

	/**
	 * Initializes the Jobs plugin group with configurable child plugins.
	 * @param opts The options for initializing the Jobs plugin group.
	 * @returns The initialized Jobs plugin group.
	 */
	init(opts: { plugins: PluginUiDefinition[] }): PluginUiDefinition {
		return {
			...JobsPlugin,
			plugins: opts.plugins
		};
	}
};
