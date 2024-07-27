import { NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterModule, ROUTES } from '@angular/router';
import { filter, merge } from 'rxjs';
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
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { MomentModule } from 'ngx-moment';
import { NgxPermissionsModule, NgxPermissionsService } from 'ngx-permissions';
import { CKEditorModule } from 'ckeditor4-angular';
import { FileUploadModule } from 'ng2-file-upload';
import { LanguagesEnum } from '@gauzy/contracts';
import { HttpLoaderFactory, I18nService } from '@gauzy/ui-core/i18n';
import { distinctUntilChange, Store } from '@gauzy/ui-core/common';
import { PageRouteService } from '@gauzy/ui-core/core';
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
import { SearchComponent } from './search/search.component';
import { COMPONENTS } from './components';

/**
 * NB_MODULES
 */
const NB_MODULES = [
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
	NbTooltipModule,
	NbToggleModule
];

/**
 * THIRD_PARTY_MODULES
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

/**
 * FEATURE_MODULES
 */
const FEATURE_MODULES = [
	DialogsModule,
	GauzyButtonActionModule,
	PaginationV2Module,
	ProposalTemplateSelectModule,
	SelectorsModule,
	SharedModule,
	StatusBadgeModule
];

@UntilDestroy()
@NgModule({
	imports: [RouterModule.forChild([]), ...NB_MODULES, ...THIRD_PARTY_MODULES, ...FEATURE_MODULES],
	declarations: [SearchComponent, ...COMPONENTS],
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
	constructor(
		readonly _ngxPermissionsService: NgxPermissionsService,
		readonly _store: Store,
		readonly _i18nService: I18nService,
		readonly _translateService: TranslateService
	) {
		this.initializeUiPermissions();
		this.initializeUiLanguagesAndLocale();
	}

	/**
	 * Initialize UI permissions
	 */
	private initializeUiPermissions() {
		// Load permissions
		const permissions = this._store.userRolePermissions.map(({ permission }) => permission);
		this._ngxPermissionsService.flushPermissions(); // Flush permissions
		this._ngxPermissionsService.loadPermissions(permissions); // Load permissions
	}

	/**
	 * Initialize UI languages and Update Locale
	 */
	private initializeUiLanguagesAndLocale() {
		// Observable that emits when preferred language changes.
		const preferredLanguage$ = merge(this._store.preferredLanguage$, this._i18nService.preferredLanguage$).pipe(
			distinctUntilChange(),
			filter((preferredLanguage: LanguagesEnum) => !!preferredLanguage),
			untilDestroyed(this)
		);

		// Subscribe to preferred language changes
		preferredLanguage$.subscribe((preferredLanguage: string | LanguagesEnum) => {
			this._translateService.use(preferredLanguage);
		});
	}
}
