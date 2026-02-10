import { inject, NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterModule, ROUTES } from '@angular/router';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbPopoverModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { CKEditorModule } from 'ckeditor4-angular';
import { MomentModule } from 'ngx-moment';
import { NgxPermissionsModule } from 'ngx-permissions';
import { FileUploadModule } from 'ng2-file-upload';
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
	ProposalTemplateSelectModule,
	SelectorsModule,
	SharedModule,
	StatusBadgeModule,
	getBrowserLanguage
} from '@gauzy/ui-core/shared';
import { createJobSearchRoutes } from './job-search.routes';
import { JobSearchComponent } from './components/job-search/job-search.component';
import { COMPONENTS } from './components';

/**
 * Nebular Modules
 */
const NB_MODULES = [
	NbButtonModule,
	NbCardModule,
	NbDialogModule.forChild(),
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbPopoverModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbTooltipModule,
	NbToggleModule
];

/*
 * Third Party Modules
 */
const THIRD_PARTY_MODULES = [
	CKEditorModule,
	FileUploadModule,
	MomentModule,
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
	declarations: [JobSearchComponent, ...COMPONENTS],
	imports: [
		RouterModule.forChild([]),
		...NB_MODULES,
		...THIRD_PARTY_MODULES,
		SmartDataViewLayoutModule,
		DialogsModule,
		ProposalTemplateSelectModule,
		SelectorsModule,
		SharedModule,
		StatusBadgeModule
	],
	exports: [RouterModule, ...COMPONENTS],
	providers: [
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createJobSearchRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class JobSearchModule implements IOnUIPluginBootstrap, IOnUIPluginDestroy {
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
		console.log('[JobSearchModule] Plugin bootstrapped');
	}

	/**
	 * Called by `UIPluginModule` when the application is shutting down.
	 */
	onPluginDestroy(): void {
		console.log('[JobSearchModule] Plugin destroyed');
	}

	// ─── Route & Menu Registration ────────────────────────────────

	/**
	 * Registers routes for the Job Search (Browse) module.
	 * Ensures that routes are registered only once.
	 */
	registerPageRoutes(): void {
		if (JobSearchModule.hasRegisteredPageRoutes) {
			return;
		}

		// Register Job Browser Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			location: 'jobs',
			path: 'search',
			loadChildren: () => import('./job-search.module').then((m) => m.JobSearchModule),
			data: {
				selectors: {
					date: true,
					employee: true,
					project: false,
					team: false
				}
			}
		});

		// Set hasRegisteredRoutes to true
		JobSearchModule.hasRegisteredPageRoutes = true;
	}

	/**
	 * Register navigation menu items for the Job Search (Browse) plugin.
	 */
	private registerNavMenuItems(): void {
		this._navMenuBuilderService.addNavMenuItem(
			{
				id: 'jobs-browse',
				title: 'Browse',
				icon: 'fas fa-list',
				link: '/pages/jobs/search',
				data: {
					translationKey: 'MENU.JOBS_SEARCH',
					permissionKeys: [PermissionsEnum.ORG_JOB_SEARCH]
				}
			},
			'jobs',
			'jobs-proposal-template' // Insert before proposal-template
		);
	}
}

/**
 * Plugin definition for the Job Search UI plugin.
 */
export const JobSearchPlugin: GauzyUIPlugin = {
	id: 'job-search',
	module: JobSearchModule,
	location: 'jobs'
};
