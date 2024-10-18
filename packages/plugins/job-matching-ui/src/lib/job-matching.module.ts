import { Inject, NgModule } from '@angular/core';
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
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
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
		defaultLanguage: getBrowserLanguage(), // Get the browser language and fall back to a default if needed
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
export class JobMatchingModule {
	private static hasRegisteredPageRoutes = false; // Flag to check if routes have been registered

	constructor(
		@Inject(PageRouteRegistryService) private readonly _pageRouteRegistryService: PageRouteRegistryService
	) {
		// Register the routes
		this.registerPageRoutes();
	}

	/**
	 * Registers routes for the Jobs browser module.
	 * Ensures that routes are registered only once.
	 *
	 * @returns {void}
	 */
	registerPageRoutes(): void {
		if (JobMatchingModule.hasRegisteredPageRoutes) {
			return;
		}

		// Register Job Matching Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			// Register the location 'jobs'
			location: 'jobs',
			// Register the path 'matching'
			path: 'matching',
			// Register the loadChildren function to load the MatchingModule lazy module
			loadChildren: () => import('./job-matching.module').then((m) => m.JobMatchingModule),
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
		JobMatchingModule.hasRegisteredPageRoutes = true;
	}
}
