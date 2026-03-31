import { PermissionsEnum } from '@gauzy/contracts';
import { PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { JobEmployeeModule } from './job-employee.module';
import { JOB_EMPLOYEE_PAGE_LINK, JOB_EMPLOYEE_PAGE_ROUTE } from './job-employee.routes';

/**
 * Job Employee plugin definition.
 *
 * Registers the /pages/jobs/employee route and adds an "Employee" nav item under the Jobs section.
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
export const JobEmployeePlugin: PluginUiDefinition = {
	id: 'job-employee',

	// ── Versioning & Compatibility ────────────────────────────────
	version: '0.1.0',

	// ── Location & Module ────────────────────────────────────────
	location: 'jobs-sections',
	module: JobEmployeeModule,

	// ── Access Control ───────────────────────────────────────────
	permissionKeys: [PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW],

	// ── Routes ───────────────────────────────────────────────────
	routes: [JOB_EMPLOYEE_PAGE_ROUTE as PluginRouteInput],

	// ── Navigation ───────────────────────────────────────────────
	navMenu: [
		{
			type: 'section' as const,
			sectionId: 'jobs',
			items: [
				{
					id: 'jobs-employee',
					title: 'Employee',
					icon: 'fas fa-user-friends',
					link: JOB_EMPLOYEE_PAGE_LINK,
					data: {
						translationKey: 'MENU.EMPLOYEES',
						permissionKeys: [PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW]
					}
				}
			]
		}
	]
};
