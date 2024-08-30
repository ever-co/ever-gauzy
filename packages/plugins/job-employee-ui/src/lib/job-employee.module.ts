import { Inject, NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterModule, ROUTES } from '@angular/router';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule
} from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { LanguagesEnum } from '@gauzy/contracts';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import { DynamicTabsModule, SharedModule, SmartDataViewLayoutModule } from '@gauzy/ui-core/shared';
import { createJobEmployeeRoutes } from './job-employee.routes';
import { JobEmployeeComponent } from './components/job-employee/job-employee.component';

/**
 * Nebular Modules
 */
const NB_MODULES = [NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule, NbTabsetModule, NbToggleModule];

/*
 * Third party modules
 */
const THIRD_PARTY_MODULES = [
	NgxPermissionsModule.forRoot(),
	TranslateModule.forRoot({
		defaultLanguage: LanguagesEnum.ENGLISH,
		loader: {
			provide: TranslateLoader,
			useFactory: HttpLoaderFactory,
			deps: [HttpClient]
		}
	})
];

@NgModule({
	declarations: [JobEmployeeComponent],
	imports: [
		RouterModule.forChild([]),
		...NB_MODULES,
		...THIRD_PARTY_MODULES,
		SharedModule,
		SmartDataViewLayoutModule,
		DynamicTabsModule
	],
	providers: [
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createJobEmployeeRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class JobEmployeeModule {
	private static hasRegisteredPageRoutes = false; // Flag to check if routes have been registered

	constructor(
		@Inject(PageRouteRegistryService)
		private readonly _pageRouteRegistryService: PageRouteRegistryService
	) {
		this.registerPageRoutes(this._pageRouteRegistryService); // Register the routes
	}

	/**
	 * Register routes for the JobEmployeeModule
	 *
	 * @param _pageRouteRegistryService
	 * @returns {void}
	 */
	registerPageRoutes(_pageRouteRegistryService: PageRouteRegistryService): void {
		if (JobEmployeeModule.hasRegisteredPageRoutes) {
			return;
		}

		// Register Job Employee Page Routes
		_pageRouteRegistryService.registerPageRoute({
			// Register the location 'jobs'
			location: 'jobs',
			// Register the path 'employee'
			path: 'employee',
			// Register the loadChildren function to load the EmployeesModule lazy module
			loadChildren: () => import('./job-employee.module').then((m) => m.JobEmployeeModule),
			// Register the data object
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
		JobEmployeeModule.hasRegisteredPageRoutes = true;
	}
}
