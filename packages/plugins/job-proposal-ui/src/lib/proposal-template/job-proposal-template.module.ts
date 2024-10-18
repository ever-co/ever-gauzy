import { Inject, NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ROUTES, RouterModule } from '@angular/router';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { CKEditorModule } from 'ckeditor4-angular';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import {
	SmartDataViewLayoutModule,
	DialogsModule,
	EmployeeMultiSelectModule,
	SharedModule,
	StatusBadgeModule,
	getBrowserLanguage
} from '@gauzy/ui-core/shared';
import { createJobProposalTemplateRoutes } from './job-proposal-template.routes';
import { ProposalTemplateComponent } from './components/proposal-template/proposal-template.component';
import { AddEditProposalTemplateComponent } from './components/add-edit-proposal-template/add-edit-proposal-template.component';

// Nebular Modules
const NB_MODULES = [
	NbButtonModule,
	NbCardModule,
	NbDialogModule.forChild(),
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
];

// Third Party Modules
const THIRD_PARTY_MODULES = [
	CKEditorModule,
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
	declarations: [ProposalTemplateComponent, AddEditProposalTemplateComponent],
	imports: [
		RouterModule.forChild([]),
		...NB_MODULES,
		...THIRD_PARTY_MODULES,
		SharedModule,
		SmartDataViewLayoutModule,
		StatusBadgeModule,
		EmployeeMultiSelectModule,
		DialogsModule
	],
	providers: [
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createJobProposalTemplateRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class JobProposalTemplateModule {
	private static hasRegisteredPageRoutes = false; // Flag to check if routes have been registered

	constructor(
		@Inject(PageRouteRegistryService) private readonly _pageRouteRegistryService: PageRouteRegistryService
	) {
		// Register the routes
		this.registerPageRoutes();
	}

	/**
	 * Registers routes for the Jobs proposal template module.
	 * Ensures that routes are registered only once.
	 *
	 * @returns {void}
	 */
	async registerPageRoutes(): Promise<void> {
		if (JobProposalTemplateModule.hasRegisteredPageRoutes) {
			return;
		}

		// Register Job Proposal Template Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			// Register the location 'jobs'
			location: 'jobs',
			// Register the path 'proposal-template'
			path: 'proposal-template',
			// Register the loadChildren function to load the ProposalTemplateModule lazy module
			loadChildren: () => import('./job-proposal-template.module').then((m) => m.JobProposalTemplateModule),
			// Register the data object
			data: {
				selectors: {
					project: false,
					team: false
				}
			}
		});

		// Set hasRegisteredRoutes to true
		JobProposalTemplateModule.hasRegisteredPageRoutes = true;
	}
}
