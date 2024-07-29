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
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { CKEditorModule } from 'ckeditor4-angular';
import { MomentModule } from 'ngx-moment';
import { NgxPermissionsModule } from 'ngx-permissions';
import { FileUploadModule } from 'ng2-file-upload';
import { LanguagesEnum } from '@gauzy/contracts';
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
import { createRoutes } from './search.routes';
import { SearchComponent } from './components/search/search.component';
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
		defaultLanguage: LanguagesEnum.ENGLISH,
		loader: {
			provide: TranslateLoader,
			useFactory: HttpLoaderFactory,
			deps: [HttpClient]
		}
	})
];

@NgModule({
	declarations: [SearchComponent, ...COMPONENTS],
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
	exports: [...COMPONENTS],
	providers: [
		{
			provide: ROUTES,
			useFactory: (pageRouteService: PageRouteService) => createRoutes(pageRouteService),
			deps: [PageRouteService],
			multi: true
		}
	]
})
export class SearchModule {
	private static hasRegisteredPageRoutes = false; // Flag to check if routes have been registered

	constructor(readonly _pageRouteService: PageRouteService, readonly _translateService: TranslateService) {
		// Register the routes
		this.registerPageRoutes();
	}

	/**
	 * Called when the plugin is Bootstraped .
	 *
	 * @returns {void | Promise<void>}
	 * @memberof SearchModule
	 */
	onPluginBootstrap(): void | Promise<void> {
		console.log(`${SearchModule.name} is being bootstrapped...`);
	}

	/**
	 * Called when the plugin is destroyed.
	 *
	 * @returns {void | Promise<void>}
	 * @memberof SearchModule
	 */
	onPluginDestroy(): void | Promise<void> {
		console.log(`${SearchModule.name} is being destroyed...`);
	}

	/**
	 * Registers routes for the Jobs browser module.
	 * Ensures that routes are registered only once.
	 *
	 * @returns {void}
	 */
	registerPageRoutes(): void {
		if (SearchModule.hasRegisteredPageRoutes) {
			return;
		}

		// Register Job Browser Page Routes
		this._pageRouteService.registerPageRoute({
			// Register the location 'jobs'
			location: 'jobs',
			// Register the path 'search'
			path: 'search',
			// Register the loadChildren function to load the SearchModule lazy module
			loadChildren: () => import('./search.module').then((m) => m.SearchModule),
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
		SearchModule.hasRegisteredPageRoutes = true;
	}
}
