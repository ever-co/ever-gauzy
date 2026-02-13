import { PluginUiDefinition } from '@gauzy/plugin-ui';
import { JobEmployeePlugin } from '@gauzy/plugin-job-employee-ui';
import { JobMatchingPlugin } from '@gauzy/plugin-job-matching-ui';
import { JobSearchPlugin } from '@gauzy/plugin-job-search-ui';
import { JobProposalTemplatePlugin } from '@gauzy/plugin-job-proposal-ui';
import { JobsModule } from './jobs.module';

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
 * @example In plugin-ui.config.ts:
 * ```ts
 * plugins: [JobsPlugin]
 * ```
 *
 * @example Customize child plugins with init:
 * ```ts
 * plugins: [JobsPlugin.init({ plugins: [JobEmployeePlugin, JobSearchPlugin] })]
 * ```
 */
export const JobsPlugin: JobsPluginDefinition = {
	id: 'jobs',
	location: 'jobs-sections',
	module: JobsModule,
	plugins: DEFAULT_JOBS_PLUGINS,

	/**
	 * Initializes the Jobs plugin group with configurable child plugins.
	 * @param opts The options for initializing the Jobs plugin group.
	 * @returns The initialized Jobs plugin group.
	 */
	init(opts: { plugins: PluginUiDefinition[] }): PluginUiDefinition {
		return {
			id: 'jobs',
			location: 'jobs-sections',
			module: JobsModule,
			plugins: opts.plugins
		};
	}
};
