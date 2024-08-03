import { NgModule } from '@angular/core';
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
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { CKEditorModule } from 'ckeditor4-angular';
import { MomentModule } from 'ngx-moment';
import { NgxPermissionsModule } from 'ngx-permissions';
import { FileUploadModule } from 'ng2-file-upload';
import { PageRouteService } from '@gauzy/ui-core/core';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import {
	DialogsModule,
	GauzyButtonActionModule,
	PaginationV2Module,
	ProposalTemplateSelectModule,
	SelectorsModule,
	SharedModule,
	StatusBadgeModule
} from '@gauzy/ui-core/shared';
import { createRoutes } from './job-search.routes';
import { JobSearchComponent } from './components/job-search/job-search.component';
import { COMPONENTS } from './components';

/**
 * Nebular modules
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
 * Third party modules
 */
const THIRD_PARTY_MODULES = [
	Angular2SmartTableModule,
	CKEditorModule,
	FileUploadModule,
	MomentModule,
	NgxPermissionsModule.forRoot(),
	TranslateModule.forRoot({
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
		DialogsModule,
		GauzyButtonActionModule,
		PaginationV2Module,
		ProposalTemplateSelectModule,
		SelectorsModule,
		SharedModule,
		StatusBadgeModule
	],
	exports: [RouterModule, ...COMPONENTS],
	providers: [
		{
			provide: ROUTES,
			useFactory: (pageRouteService: PageRouteService) => createRoutes(pageRouteService),
			deps: [PageRouteService],
			multi: true
		}
	]
})
export class JobSearchModule {
	private static hasRegisteredPageRoutes = false; // Flag to check if routes have been registered

	constructor(readonly _pageRouteService: PageRouteService) {
		// Register the routes
		this.registerPageRoutes();
	}

	/**
	 * Called when the plugin is bootstrapped.
	 *
	 * @returns {void | Promise<void>}
	 * @memberof JobSearchModule
	 */
	onPluginBootstrap(): void | Promise<void> {
		console.log(`${JobSearchModule.name} is being bootstrapped...`);
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
		this._pageRouteService.registerPageRoute({
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

	/**
	 * Called when the plugin is destroyed.
	 *
	 * @returns {void | Promise<void>}
	 * @memberof JobSearchModule
	 */
	onPluginDestroy(): void | Promise<void> {
		console.log(`${JobSearchModule.name} is being destroyed...`);
	}
}
