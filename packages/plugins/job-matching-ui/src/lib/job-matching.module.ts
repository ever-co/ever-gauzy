import { inject, NgModule } from '@angular/core';
import { RouterModule, ROUTES } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { PluginUiDefinition, IOnPluginUiBootstrap, IOnPluginUiDestroy } from '@gauzy/plugin-ui';
import { LoggerService, NavMenuBuilderService, PageRouteRegistryService } from '@gauzy/ui-core/core';
import { DialogsModule, NebularModule, SharedModule } from '@gauzy/ui-core/shared';
import { createJobMatchingRoutes } from './job-matching.routes';
import { JobMatchingComponent } from './components/job-matching/job-matching.component';
import { COMPONENTS } from './components';

@NgModule({
	declarations: [JobMatchingComponent, ...COMPONENTS],
	imports: [
		RouterModule.forChild([]),
		NebularModule,
		TranslateModule.forChild(),
		NgSelectModule,
		SharedModule,
		DialogsModule
	],
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
export class JobMatchingModule implements IOnPluginUiBootstrap, IOnPluginUiDestroy {
	private static hasRegisteredPageRoutes = false;

	private readonly _log = inject(LoggerService).withContext('JobMatchingModule');
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
export const JobMatchingPlugin: PluginUiDefinition = {
	id: 'job-matching',
	module: JobMatchingModule,
	location: 'jobs'
};
