import { NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { filter, merge } from 'rxjs';
import {
	NbActionsModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbContextMenuModule,
	NbDatepickerModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgxPermissionsModule, NgxPermissionsService } from 'ngx-permissions';
import { LanguagesEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { HttpLoaderFactory, I18nService } from '@gauzy/ui-core/i18n';
import { getBrowserLanguage, SmartDataViewLayoutModule, SharedModule } from '@gauzy/ui-core/shared';
import { IntegrationHubstaffRoutingModule } from './integration-hubstaff-routing.module';
import { HubstaffComponent } from './components/hubstaff/hubstaff.component';
import { HubstaffAuthorizeComponent } from './components/hubstaff-authorize/hubstaff-authorize.component';
import { SettingsDialogComponent } from './components/settings-dialog/settings-dialog.component';

// Nebular Modules
const NB_MODULES = [
	NbActionsModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbContextMenuModule,
	NbDatepickerModule,
	NbDialogModule.forChild(),
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule,
	NbTooltipModule
];

// Third Party Modules
const THIRD_PARTY_MODULES = [
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
	declarations: [HubstaffAuthorizeComponent, HubstaffComponent, SettingsDialogComponent],
	imports: [
		...NB_MODULES,
		...THIRD_PARTY_MODULES,
		IntegrationHubstaffRoutingModule,
		SharedModule,
		SmartDataViewLayoutModule
	]
})
@UntilDestroy()
export class IntegrationHubstaffModule {
	constructor(
		readonly _translateService: TranslateService,
		readonly _ngxPermissionsService: NgxPermissionsService,
		readonly _store: Store,
		readonly _i18nService: I18nService
	) {
		this.initializeUiPermissions(); // Initialize UI permissions
		this.initializeUiLanguagesAndLocale(); // Initialize UI languages and Update Locale
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
			filter((lang: LanguagesEnum) => !!lang),
			untilDestroyed(this)
		);

		// Subscribe to preferred language changes
		preferredLanguage$.subscribe((lang: string | LanguagesEnum) => {
			this._translateService.use(lang);
		});
	}
}
