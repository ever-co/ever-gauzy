import { Inject, NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ROUTES, RouterModule } from '@angular/router';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDatepickerModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { NgChartsModule } from 'ng2-charts';
import { NgxPermissionsModule } from 'ngx-permissions';
import { CKEditorModule } from 'ckeditor4-angular';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryService, PermissionsGuard } from '@gauzy/ui-core/core';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import {
	SmartDataViewLayoutModule,
	SharedModule,
	SelectorsModule,
	TableFiltersModule,
	ContactSelectModule,
	ProposalTemplateSelectModule,
	CardGridModule,
	UserFormsModule,
	TableComponentsModule,
	TagsColorInputModule,
	DateRangePickerResolver,
	getBrowserLanguage
} from '@gauzy/ui-core/shared';
import { createProposalsRoutes } from './job-proposal.routes';
import { COMPONENTS, ProposalDetailsComponent, ProposalEditComponent, ProposalRegisterComponent } from './components';
import { ProposalComponent } from './components/proposal/proposal.component';
import { ProposalDetailsResolver } from './resolvers/proposal-details.resolver';

/**
 * Redirects to the dashboard page
 *
 * @returns
 */
function redirectTo() {
	return '/pages/dashboard';
}

/**
 * NB Modules
 */
const NB_MODULES = [
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDatepickerModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbTooltipModule
];

/**
 * Third Party Modules
 */
const THIRD_PARTY_MODULES = [
	CKEditorModule,
	NgChartsModule,
	NgSelectModule,
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
	imports: [
		RouterModule.forChild([]),
		...NB_MODULES,
		...THIRD_PARTY_MODULES,
		SharedModule,
		TagsColorInputModule,
		TableComponentsModule,
		UserFormsModule,
		CardGridModule,
		ProposalTemplateSelectModule,
		SmartDataViewLayoutModule,
		ContactSelectModule,
		TableFiltersModule,
		SelectorsModule
	],
	declarations: [...COMPONENTS],
	exports: [RouterModule],
	providers: [
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createProposalsRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class JobProposalModule {
	private static hasRegisteredPageRoutes = false; // Flag to check if routes have been registered

	constructor(
		@Inject(PageRouteRegistryService)
		readonly _pageRouteRegistryService: PageRouteRegistryService
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
		if (JobProposalModule.hasRegisteredPageRoutes) {
			return;
		}

		// Register Job Proposal Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			// Register the location 'jobs'
			location: 'proposals',
			// Register the path 'proposal-template'
			path: '',
			// Register the component
			component: ProposalComponent,
			// Register the canActivate guard
			canActivate: [PermissionsGuard],
			// Register the data object
			data: {
				selectors: {
					project: false,
					team: false
				},
				datePicker: { unitOfTime: 'month' }
			},
			resolve: { dates: DateRangePickerResolver }
		});

		// Register Job Proposal Register Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			// Register the location 'jobs'
			location: 'proposals',
			// Register the path 'proposal-template'
			path: 'register',
			// Register the component
			component: ProposalRegisterComponent,
			// Register the canActivate guard
			canActivate: [PermissionsGuard],
			// Register the data object
			data: {
				permissions: {
					only: [PermissionsEnum.ORG_PROPOSALS_EDIT],
					redirectTo
				},
				selectors: {
					employee: false,
					project: false,
					team: false
				},
				datePicker: { unitOfTime: 'month' }
			},
			resolve: { dates: DateRangePickerResolver }
		});

		// Register Job Proposal Details Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			// Register the location 'jobs'
			location: 'proposals',
			// Register the path 'proposal-template'
			path: 'details/:id',
			// Register the component
			component: ProposalDetailsComponent,
			// Register the canActivate guard
			canActivate: [PermissionsGuard],
			// Register the data object
			data: {
				permissions: {
					only: [PermissionsEnum.ORG_PROPOSALS_VIEW],
					redirectTo
				},
				selectors: false
			},
			resolve: { proposal: ProposalDetailsResolver }
		});

		// Register Job Proposal Edit Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			// Register the location 'jobs'
			location: 'proposals',
			// Register the path 'proposal-template'
			path: 'edit/:id',
			// Register the component
			component: ProposalEditComponent,
			// Register the canActivate guard
			canActivate: [PermissionsGuard],
			// Register the data object
			data: {
				permissions: {
					only: [PermissionsEnum.ORG_PROPOSALS_EDIT],
					redirectTo
				},
				selectors: false
			},
			resolve: { proposal: ProposalDetailsResolver }
		});

		// Set hasRegisteredRoutes to true
		JobProposalModule.hasRegisteredPageRoutes = true;
	}
}
