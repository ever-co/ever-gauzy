import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, ROUTES } from '@angular/router';
import { take } from 'rxjs/operators';
import {
	NbButtonModule,
	NbCardModule,
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
import { TranslateService } from '@ngx-translate/core';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { MomentModule } from 'ngx-moment';
import { NgxPermissionsModule, NgxPermissionsService } from 'ngx-permissions';
import { pluck, union } from 'underscore';
import { ILanguage, LanguagesEnum } from '@gauzy/contracts';
import { I18nTranslateService } from '@gauzy/ui-core/i18n';
import { distinctUntilChange, Store } from '@gauzy/ui-core/common';
import { PageRouteService } from '@gauzy/ui-core/core';
import {
	DialogsModule,
	GauzyButtonActionModule,
	PaginationV2Module,
	SharedModule,
	StatusBadgeModule
} from '@gauzy/ui-core/shared';
import { ApplyJobManuallyModule, JobTableComponentsModule } from './components';
import { createRoutes } from './search.routes';
import { SearchComponent } from './search/search.component';

/**
 * NB_MODULES
 */
const NB_MODULES = [
	NbButtonModule,
	NbCardModule,
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
const THIRD_PARTY_MODULES = [Angular2SmartTableModule, MomentModule, NgxPermissionsModule.forRoot()];

/**
 * FEATURE_MODULES
 */
const FEATURE_MODULES = [
	DialogsModule,
	GauzyButtonActionModule,
	PaginationV2Module,
	SharedModule,
	StatusBadgeModule,
	ApplyJobManuallyModule,
	JobTableComponentsModule
];

@UntilDestroy()
@NgModule({
	declarations: [SearchComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		RouterModule.forChild([]),
		...NB_MODULES,
		...THIRD_PARTY_MODULES,
		...FEATURE_MODULES
	],
	providers: [
		{
			provide: ROUTES,
			useFactory: (pageRouteService: PageRouteService) => createRoutes(pageRouteService),
			deps: [PageRouteService],
			multi: true
		}
	],
	exports: []
})
export class SearchModule {
	constructor(
		readonly _ngxPermissionsService: NgxPermissionsService,
		readonly _store: Store,
		readonly _i18nTranslateService: I18nTranslateService,
		readonly _translateService: TranslateService
	) {
		this.setUiPermissions();
		this.setUiLanguages();
	}

	/**
	 * Sets the permissions for the application.
	 */
	private setUiPermissions() {
		// Load permissions
		const permissions = this._store.userRolePermissions.map(({ permission }) => permission);
		this._ngxPermissionsService.flushPermissions(); // Flush permissions
		this._ngxPermissionsService.loadPermissions(permissions); // Load permissions
	}

	/**
	 * Sets the UI languages for the application.
	 */
	private setUiLanguages() {
		// Observable that emits when system languages change.
		const systemLanguages$ = this._store.systemLanguages$.pipe(
			distinctUntilChange(),
			untilDestroyed(this),
			take(1)
		);

		// Observable that emits when system languages change.
		systemLanguages$.subscribe(() => {
			// Retrieve the browser's language code, e.g., "en", "bg", "he", "ru"
			const browserLang = this._i18nTranslateService.getBrowserLang();

			// Get the default available enum languages, e.g., "en", "bg", "he", "ru"
			const availableLanguages: string[] = this._i18nTranslateService.availableLanguages;

			// Determine the preferred language from the store, if available
			const preferredLanguage = this._store.user?.preferredLanguage ?? this._store.preferredLanguage ?? null;

			// Determine the system language or default to English
			const systemLanguage = availableLanguages.includes(browserLang) ? browserLang : LanguagesEnum.ENGLISH;

			// Set the selected language in the translation service
			this._translateService.use(preferredLanguage || systemLanguage);
		});
	}
}
