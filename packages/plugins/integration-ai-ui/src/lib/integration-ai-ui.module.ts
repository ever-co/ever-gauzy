import { NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { filter, merge, tap } from 'rxjs';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgxPermissionsModule, NgxPermissionsService } from 'ngx-permissions';
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { LanguagesEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { HttpLoaderFactory, I18nService } from '@gauzy/ui-core/i18n';
import { SharedModule, WorkInProgressModule, getBrowserLanguage } from '@gauzy/ui-core/shared';
import { IntegrationAiRoutes } from './integration-ai.routes';
import { IntegrationAILayoutComponent } from './integration-ai.layout.component';
import { IntegrationAIAuthorizationComponent } from './components/authorization/authorization.component';
import { IntegrationAIViewComponent } from './components/view/view.component';
import { IntegrationSettingCardComponent } from './components/integration-setting-card/integration-setting-card.component';

@NgModule({
	declarations: [
		IntegrationAILayoutComponent,
		IntegrationAIAuthorizationComponent,
		IntegrationAIViewComponent,
		IntegrationSettingCardComponent
	],
	imports: [
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbTabsetModule,
		NbToggleModule,
		NbTooltipModule,
		NgxPermissionsModule.forRoot(),
		TranslateModule.forRoot({
			defaultLanguage: getBrowserLanguage(), // Get the browser language and fall back to a default if needed
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		IntegrationAiRoutes,
		WorkInProgressModule,
		SharedModule
	]
})
@UntilDestroy()
export class IntegrationAiUiModule {
	constructor(
		readonly _translateService: TranslateService,
		readonly _ngxPermissionsService: NgxPermissionsService,
		readonly _store: Store,
		readonly _i18nService: I18nService
	) {
		this.initializeUiPermissions(); // Initialize UI permissions
		this.initializeUiLanguagesAndLocale(); // Initialize UI languages and Update Locale
		console.log(`integration ai ui module plugin initialized`);
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
			tap((lang: string | LanguagesEnum) => {
				this._translateService.use(lang);
			}),
			untilDestroyed(this)
		);

		// Subscribe to initiate the stream
		preferredLanguage$.subscribe();
	}
}
