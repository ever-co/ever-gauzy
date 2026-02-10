import { inject, NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterModule, ROUTES } from '@angular/router';
import {
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbIconModule,
	NbInputModule,
	NbPopoverModule,
	NbRadioModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import {
	GauzyUIPlugin,
	IOnUIPluginBootstrap,
	IOnUIPluginDestroy,
	NavMenuBuilderService,
	PageRouteRegistryService
} from '@gauzy/ui-core/core';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import { DialogsModule, SharedModule, getBrowserLanguage } from '@gauzy/ui-core/shared';
import { createJobMatchingRoutes } from './job-matching.routes';
import { JobMatchingComponent } from './components/job-matching/job-matching.component';
import { COMPONENTS } from './components';

/**
 * Nebular modules
 */
const NB_MODULES = [
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbIconModule,
	NbInputModule,
	NbPopoverModule,
	NbRadioModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
];

/*
 * Third party modules
 */
const THIRD_PARTY_MODULES = [
	NgxPermissionsModule.forRoot(),
	NgSelectModule,
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
	declarations: [JobMatchingComponent, ...COMPONENTS],
	imports: [RouterModule.forChild([]), ...NB_MODULES, ...THIRD_PARTY_MODULES, SharedModule, DialogsModule],
	exports: [RouterModule, ...COMPONENTS],
	providers: [
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createJobMatchingRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class JobMatchingModule implements IOnUIPluginBootstrap, IOnUIPluginDestroy {
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
		console.log('[JobMatchingModule] Plugin bootstrapped');
	}

	/**
	 * Called by `UIPluginModule` when the application is shutting down.
	 */
	onPluginDestroy(): void {
		console.log('[JobMatchingModule] Plugin destroyed');
	}

	// ─── Route & Menu Registration ────────────────────────────────

	/**
	 * Registers routes for the Job Matching module.
	 * Ensures that routes are registered only once.
	 */
	registerPageRoutes(): void {
		if (JobMatchingModule.hasRegisteredPageRoutes) {
			return;
		}

		// Register Job Matching Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			location: 'jobs',
			path: 'matching',
			loadChildren: () => import('./job-matching.module').then((m) => m.JobMatchingModule),
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
		JobMatchingModule.hasRegisteredPageRoutes = true;
	}

	/**
	 * Register navigation menu items for the Job Matching plugin.
	 */
	private registerNavMenuItems(): void {
		this._navMenuBuilderService.addNavMenuItem(
			{
				id: 'jobs-matching',
				title: 'Matching',
				icon: 'fas fa-user',
				link: '/pages/jobs/matching',
				data: {
					translationKey: 'MENU.JOBS_MATCHING',
					permissionKeys: [PermissionsEnum.ORG_JOB_MATCHING_VIEW]
				}
			},
			'jobs',
			'jobs-proposal-template' // Insert before proposal-template
		);
	}
}

/**
 * Plugin definition for the Job Matching UI plugin.
 */
export const JobMatchingPlugin: GauzyUIPlugin = {
	id: 'job-matching',
	module: JobMatchingModule,
	location: 'jobs'
};
