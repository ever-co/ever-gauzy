import { inject, NgModule } from '@angular/core';
import { RouterModule, ROUTES } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CKEditorModule } from 'ckeditor4-angular';
import { MomentModule } from 'ngx-moment';
import { NgxPermissionsModule } from 'ngx-permissions';
import { FileUploadModule } from 'ng2-file-upload';
import { PermissionsEnum } from '@gauzy/contracts';
import {
	GauzyUIPlugin,
	IOnUIPluginBootstrap,
	IOnUIPluginDestroy,
	LoggerService,
	NavMenuBuilderService,
	PageRouteRegistryService
} from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	DialogsModule,
	NebularModule,
	ProposalTemplateSelectModule,
	SelectorsModule,
	SharedModule,
	StatusBadgeModule
} from '@gauzy/ui-core/shared';
import { createJobSearchRoutes } from './job-search.routes';
import { JobSearchComponent } from './components/job-search/job-search.component';
import { COMPONENTS } from './components';

@NgModule({
	declarations: [JobSearchComponent, ...COMPONENTS],
	imports: [
		RouterModule.forChild([]),
		NebularModule,
		CKEditorModule,
		FileUploadModule,
		MomentModule,
		TranslateModule.forChild(),
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

	private readonly _log = inject(LoggerService).withContext('JobSearchModule');
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
	ngOnPluginBootstrap(): void {
		this._log.log('Plugin bootstrapped');
	}

	/**
	 * Called by `UIPluginModule` when the application is shutting down.
	 */
	ngOnPluginDestroy(): void {
		this._log.log('Plugin destroyed');
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
