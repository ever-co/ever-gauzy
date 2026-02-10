import { inject, NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ROUTES, RouterModule } from '@angular/router';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { CKEditorModule } from 'ckeditor4-angular';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { PermissionsEnum } from '@gauzy/contracts';
import {
	GauzyUIPlugin,
	IOnUIPluginBootstrap,
	IOnUIPluginDestroy,
	NavMenuBuilderService,
	PageRouteRegistryService
} from '@gauzy/ui-core/core';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import {
	SmartDataViewLayoutModule,
	DialogsModule,
	EmployeeMultiSelectModule,
	SharedModule,
	StatusBadgeModule,
	getBrowserLanguage
} from '@gauzy/ui-core/shared';
import { createJobProposalTemplateRoutes } from './job-proposal-template.routes';
import { ProposalTemplateComponent } from './components/proposal-template/proposal-template.component';
import { AddEditProposalTemplateComponent } from './components/add-edit-proposal-template/add-edit-proposal-template.component';

// Nebular Modules
const NB_MODULES = [
	NbButtonModule,
	NbCardModule,
	NbDialogModule.forChild(),
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
];

// Third Party Modules
const THIRD_PARTY_MODULES = [
	CKEditorModule,
	NgxPermissionsModule.forRoot(),
	TranslateModule.forRoot({
		defaultLanguage: getBrowserLanguage(),
		loader: {
			provide: TranslateLoader,
			useFactory: HttpLoaderFactory,
			deps: [HttpClient]
		}
	})
];

@NgModule({
	declarations: [ProposalTemplateComponent, AddEditProposalTemplateComponent],
	imports: [
		RouterModule.forChild([]),
		...NB_MODULES,
		...THIRD_PARTY_MODULES,
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
export class JobProposalTemplateModule implements IOnUIPluginBootstrap, IOnUIPluginDestroy {
	private static hasRegisteredPageRoutes = false;

	private readonly _pageRouteRegistryService = inject(PageRouteRegistryService);
	private readonly _navMenuBuilderService = inject(NavMenuBuilderService);

	constructor() {
		this.registerPageRoutes();
		this.registerNavMenuItems();
	}

	// ─── Plugin Lifecycle ─────────────────────────────────────────

	/**
	 * Called by `UIPluginModule` after the module is instantiated.
	 */
	onPluginBootstrap(): void {
		console.log('[JobProposalTemplateModule] Plugin bootstrapped');
	}

	/**
	 * Called by `UIPluginModule` when the application is shutting down.
	 */
	onPluginDestroy(): void {
		console.log('[JobProposalTemplateModule] Plugin destroyed');
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
			location: 'jobs',
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
			'jobs' // The parent section id
		);
	}
}

/**
 * Plugin definition for the Job Proposal Template UI plugin.
 */
export const JobProposalTemplatePlugin: GauzyUIPlugin = {
	id: 'job-proposal-template',
	module: JobProposalTemplateModule,
	location: 'jobs'
};
