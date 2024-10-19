import { Inject, NgModule } from '@angular/core';
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
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
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
		defaultLanguage: getBrowserLanguage(), // Get the browser language and fall back to a default if needed
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
export class JobSearchModule {
	private static hasRegisteredPageRoutes = false; // Flag to check if routes have been registered

	constructor(@Inject(PageRouteRegistryService) readonly _pageRouteRegistryService: PageRouteRegistryService) {
		// Register the routes
		this.registerPageRoutes();
	}

	/**
	 * Registers routes for the jobs browser module.
	 * Ensures that routes are registered only once.
	 *
	 * @returns {void}
	 */
	registerPageRoutes(): void {
		if (JobSearchModule.hasRegisteredPageRoutes) {
			return;
		}

		// Register Job Browser Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			// Register the location 'jobs'
			location: 'jobs',
			// Register the path 'search'
			path: 'search',
			// Register the loadChildren function to load the JobSearchModule lazy module
			loadChildren: () => import('./job-search.module').then((m) => m.JobSearchModule),
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
		JobSearchModule.hasRegisteredPageRoutes = true;
	}
}
