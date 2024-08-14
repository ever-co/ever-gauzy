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
import { LanguagesEnum } from '@gauzy/contracts';
import { PageRouteService } from '@gauzy/ui-core/core';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import {
	SmartDataViewLayoutModule,
	DialogsModule,
	EmployeeMultiSelectModule,
	SharedModule,
	StatusBadgeModule
} from '@gauzy/ui-core/shared';
import { createRoutes } from './job-proposal-template.routes';
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
		defaultLanguage: LanguagesEnum.ENGLISH,
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
			useFactory: (pageRouteService: PageRouteService) => createRoutes(pageRouteService),
			deps: [PageRouteService],
			multi: true
		}
	]
})
export class JobProposalTemplateModule {
	private static hasRegisteredPageRoutes = false; // Flag to check if routes have been registered

	constructor(@Inject(PageRouteService) private readonly _pageRouteService: PageRouteService) {
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
		this._pageRouteService.registerPageRoute({
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
