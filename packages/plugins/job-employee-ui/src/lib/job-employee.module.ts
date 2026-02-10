import { inject, NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import {
	GauzyUIPlugin,
	IOnUIPluginBootstrap,
	IOnUIPluginDestroy,
	NavMenuBuilderService,
	PageRouteRegistryService,
	PermissionsGuard
} from '@gauzy/ui-core/core';
import { DynamicTabsModule, SharedModule, SmartDataViewLayoutModule } from '@gauzy/ui-core/shared';
import { JobEmployeeComponent } from './components/job-employee/job-employee.component';

@NgModule({
	declarations: [JobEmployeeComponent],
	imports: [
		RouterModule.forChild([]),
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbSpinnerModule,
		NbTabsetModule,
		NbToggleModule,
		NgxPermissionsModule,
		TranslateModule.forChild(),
		SharedModule,
		SmartDataViewLayoutModule,
		DynamicTabsModule
	],
	exports: [JobEmployeeComponent]
})
export class JobEmployeeModule implements IOnUIPluginBootstrap, IOnUIPluginDestroy {
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
		console.log('[JobEmployeeModule] Plugin bootstrapped');
	}

	/**
	 * Called by `UIPluginModule` when the application is shutting down.
	 */
	onPluginDestroy(): void {
		console.log('[JobEmployeeModule] Plugin destroyed');
	}

	// ─── Route & Menu Registration ────────────────────────────────

	/**
	 * Register routes for the JobEmployeeModule.
	 */
	private registerPageRoutes(): void {
		if (JobEmployeeModule.hasRegisteredPageRoutes) {
			return;
		}

		// Register Job Employee Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			location: 'jobs',
			path: 'employee',
			component: JobEmployeeComponent,
			canActivate: [PermissionsGuard],
			data: {
				tabsetId: 'job-employee',
				dataTableId: 'job-employee',
				selectors: {
					date: true,
					employee: true,
					project: false,
					team: false
				},
				permissions: {
					only: [PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW],
					redirectTo: '/pages/jobs/search'
				}
			}
		});

		// Set hasRegisteredRoutes to true
		JobEmployeeModule.hasRegisteredPageRoutes = true;
	}

	/**
	 * Register navigation menu items for the Job Employee plugin.
	 */
	private registerNavMenuItems(): void {
		this._navMenuBuilderService.addNavMenuItem(
			{
				id: 'jobs-employee',
				title: 'Employee',
				icon: 'fas fa-user-friends',
				link: '/pages/jobs/employee',
				data: {
					translationKey: 'MENU.EMPLOYEES',
					permissionKeys: [PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW]
				}
			},
			'jobs' // The parent section id
		);
	}
}

/**
 * Plugin definition for the Job Employee UI plugin.
 */
export const JobEmployeePlugin: GauzyUIPlugin = {
	id: 'job-employee',
	module: JobEmployeeModule,
	location: 'jobs'
};
