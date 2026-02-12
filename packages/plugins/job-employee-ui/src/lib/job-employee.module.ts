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
import { PageRouteRegistryService, PermissionsGuard } from '@gauzy/ui-core/core';
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
export class JobEmployeeModule {
	private static hasRegisteredPageRoutes = false; // Flag to check if routes have been registered
	private readonly _pageRouteRegistryService = inject(PageRouteRegistryService);

	constructor() {
		this.registerPageRoutes(this._pageRouteRegistryService); // Register the routes
	}

	/**
	 * Register routes for the JobEmployeeModule
	 *
	 * @param _pageRouteRegistryService
	 * @returns {void}
	 */
	private registerPageRoutes(_pageRouteRegistryService: PageRouteRegistryService): void {
		if (JobEmployeeModule.hasRegisteredPageRoutes) {
			return;
		}

		// Register Job Employee Page Routes
		_pageRouteRegistryService.registerPageRoute({
			// Register the location 'jobs'
			location: 'jobs',
			// Register the path 'employee'
			path: 'employee',
			// Directly render the JobEmployeeComponent for this route
			component: JobEmployeeComponent,
			// Protect the route with permissions guard
			canActivate: [PermissionsGuard],
			data: {
				// Tabset and data table identifiers used by the page layout
				tabsetId: 'job-employee',
				dataTableId: 'job-employee',
				// Global page selectors configuration
				selectors: {
					date: true,
					employee: true,
					project: false,
					team: false
				},
				// Route permissions configuration
				permissions: {
					only: [PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW],
					redirectTo: '/pages/jobs/search'
				}
			}
		});

		// Set hasRegisteredRoutes to true
		JobEmployeeModule.hasRegisteredPageRoutes = true;
	}
}
