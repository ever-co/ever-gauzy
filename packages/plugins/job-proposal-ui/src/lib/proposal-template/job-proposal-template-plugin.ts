import { PermissionsEnum } from '@gauzy/contracts';
import { PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { JobProposalTemplateModule } from './job-proposal-template.module';
import { JOB_PROPOSAL_TEMPLATE_PAGE_ROUTE } from './job-proposal-template.routes';

/**
 * Job Proposal Template plugin definition.
 *
 * Registers the /pages/jobs/proposal-template route. The module adds the nav item
 * dynamically with conditional add button using Store.hasAnyPermission().
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
export const JobProposalTemplatePlugin: PluginUiDefinition = {
	// ── Versioning & Compatibility ────────────────────────────────
	version: '1.0.0',

	id: 'job-proposal-template',

	// ── Location & Module ────────────────────────────────────────
	location: 'jobs-sections',
	module: JobProposalTemplateModule,

	// ── Access Control ───────────────────────────────────────────
	permissionKeys: [PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW],

	// ── Routes ───────────────────────────────────────────────────
	routes: [JOB_PROPOSAL_TEMPLATE_PAGE_ROUTE as PluginRouteInput]
};
