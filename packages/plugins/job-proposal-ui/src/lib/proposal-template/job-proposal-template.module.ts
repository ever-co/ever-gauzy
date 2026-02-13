import { inject, NgModule } from '@angular/core';
import { ROUTES, RouterModule } from '@angular/router';
import { CKEditorModule } from 'ckeditor4-angular';
import { TranslateModule } from '@ngx-translate/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { PluginUiDefinition, IOnPluginUiBootstrap, IOnPluginUiDestroy } from '@gauzy/plugin-ui';
import { LoggerService, NavMenuBuilderService, PageRouteRegistryService } from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	DialogsModule,
	EmployeeMultiSelectModule,
	NebularModule,
	SharedModule,
	StatusBadgeModule
} from '@gauzy/ui-core/shared';
import { createJobProposalTemplateRoutes } from './job-proposal-template.routes';
import { ProposalTemplateComponent } from './components/proposal-template/proposal-template.component';
import { AddEditProposalTemplateComponent } from './components/add-edit-proposal-template/add-edit-proposal-template.component';

@NgModule({
	declarations: [ProposalTemplateComponent, AddEditProposalTemplateComponent],
	imports: [
		RouterModule.forChild([]),
		NebularModule,
		CKEditorModule,
		TranslateModule.forChild(),
		SharedModule,
		SmartDataViewLayoutModule,
		StatusBadgeModule,
		EmployeeMultiSelectModule,
		DialogsModule
	],
	providers: [
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createJobProposalTemplateRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class JobProposalTemplateModule implements IOnPluginUiBootstrap, IOnPluginUiDestroy {
	private static hasRegisteredPageRoutes = false;

	private readonly _log = inject(LoggerService).withContext('JobProposalTemplateModule');
	private readonly _pageRouteRegistryService = inject(PageRouteRegistryService);
	private readonly _navMenuBuilderService = inject(NavMenuBuilderService);

	constructor() {
		this.registerPageRoutes();
		this.registerNavMenuItems();
	}

	// ─── Plugin Lifecycle ─────────────────────────────────────────

	/**
	 * Called by `PluginUiModule` after the module is instantiated.
	 */
	ngOnPluginBootstrap(): void {
		this._log.log('Plugin bootstrapped');
	}

	/**
	 * Called by `PluginUiModule` when the application is shutting down.
	 */
	ngOnPluginDestroy(): void {
		this._log.log('Plugin destroyed');
	}

	// ─── Route & Menu Registration ────────────────────────────────

	/**
	 * Registers routes for the Job Proposal Template module.
	 * Ensures that routes are registered only once.
	 */
	registerPageRoutes(): void {
		if (JobProposalTemplateModule.hasRegisteredPageRoutes) {
			return;
		}

		// Register Job Proposal Template Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			location: 'jobs-sections',
			path: 'proposal-template',
			loadChildren: () => import('./job-proposal-template.module').then((m) => m.JobProposalTemplateModule),
			data: {
				selectors: {
					project: false,
					team: false
				}
			}
		});

		// Set hasRegisteredRoutes to true
		JobProposalTemplateModule.hasRegisteredPageRoutes = true;
	}

	/**
	 * Register navigation menu items for the Job Proposal Template plugin.
	 */
	private registerNavMenuItems(): void {
		this._navMenuBuilderService.addNavMenuItem(
			{
				id: 'jobs-proposal-template',
				title: 'Proposal Template',
				icon: 'far fa-file-alt',
				link: '/pages/jobs/proposal-template',
				data: {
					translationKey: 'MENU.PROPOSAL_TEMPLATE',
					permissionKeys: [PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW]
				}
			},
			'jobs' // Nav section id (distinct from route registry location)
		);
	}
}

/**
 * Plugin definition for the Job Proposal Template UI plugin.
 */
export const JobProposalTemplatePlugin: PluginUiDefinition = {
	id: 'job-proposal-template',
	module: JobProposalTemplateModule,
	location: 'jobs-sections'
};
