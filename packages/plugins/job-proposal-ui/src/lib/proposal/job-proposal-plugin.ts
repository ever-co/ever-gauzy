import { PermissionsEnum } from '@gauzy/contracts';
import { PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { JobProposalModule } from './job-proposal.module';
import { JOB_PROPOSAL_SALES_ROUTE } from './job-proposal.routes';

/**
 * Job Proposals plugin definition.
 *
 * Registers the proposals route at sales-sections (path: proposals) with
 * child routes (list, register, details, edit) defined in the loaded module.
 * The module adds the nav item dynamically with conditional add using Store.hasAnyPermission().
 *
 * @example In plugin-ui.config.ts:
 * ```ts
 * plugins: [JobProposalPlugin]
 * ```
 */
export const JobProposalPlugin: PluginUiDefinition = {
	id: 'job-proposal',

	// ── Versioning & Compatibility ────────────────────────────────
	version: '1.0.0',

	// ── Location & Module ────────────────────────────────────────
	location: 'sales-sections',
	module: JobProposalModule,

	// ── Access Control ───────────────────────────────────────────
	permissionKeys: [PermissionsEnum.ORG_PROPOSALS_VIEW],

	// ── Routes ───────────────────────────────────────────────────
	routes: [JOB_PROPOSAL_SALES_ROUTE as PluginRouteInput]
};
