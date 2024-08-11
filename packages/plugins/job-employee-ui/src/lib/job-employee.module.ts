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
import { PageRouteService } from '@gauzy/ui-core/core';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import { SharedModule, SmartDataViewLayoutModule } from '@gauzy/ui-core/shared';
import { createRoutes } from './job-employee.routes';
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
		SmartDataViewLayoutModule
	],
	providers: [
		{
			provide: ROUTES,
			useFactory: (pageRouteService: PageRouteService) => createRoutes(pageRouteService),
			deps: [PageRouteService],
			multi: true
		}
	]
})
export class JobEmployeeModule {
	private static hasRegisteredPageRoutes = false; // Flag to check if routes have been registered

	constructor(@Inject(PageRouteService) private readonly _pageRouteService: PageRouteService) {
		// Register the routes
		this.registerRoutes(this._pageRouteService);
	}

	/**
	 * Register routes for the JobEmployeeModule
	 *
	 * @param _pageRouteService
	 * @returns {void}
	 */
	registerRoutes(_pageRouteService: PageRouteService): void {
		if (JobEmployeeModule.hasRegisteredPageRoutes) {
			return;
		}

		// Register Job Employee Page Routes
		_pageRouteService.registerPageRoute({
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
