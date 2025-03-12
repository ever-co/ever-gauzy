// Some of the code is modified from https://github.com/akveo/ngx-admin/blob/master/src/app/app.module.ts,
// that licensed under the MIT License and Copyright (c) 2017 akveo.com.

import { VERSION } from '@angular/core';
import { APP_BASE_HREF } from '@angular/common';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { ExtraOptions, Router, RouterModule } from '@angular/router';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule, APP_INITIALIZER, ErrorHandler } from '@angular/core';
import { AkitaNgDevtools } from '@datorama/akita-ngdevtools';
import {
	NbChatModule,
	NbDatepickerModule,
	NbDialogModule,
	NbMenuModule,
	NbSidebarModule,
	NbToastrModule,
	NbWindowModule,
	NbCalendarModule,
	NbCalendarKitModule
} from '@nebular/theme';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { FileUploadModule } from 'ng2-file-upload';
import { CookieService } from 'ngx-cookie-service';
import { FeatureToggleModule } from 'ngx-feature-toggle';
import { NgxPermissionsModule } from 'ngx-permissions';
import { ColorPickerService } from 'ngx-color-picker';
import * as Sentry from '@sentry/angular-ivy';
import * as moment from 'moment';
import { IFeatureToggle, LanguagesEnum, WeekDaysEnum } from '@gauzy/contracts';
import { UiCoreModule } from '@gauzy/ui-core';
import { GAUZY_ENV, environment } from '@gauzy/ui-config';
import {
	APIInterceptor,
	AppInitService,
	CoreModule,
	FeatureService,
	GoogleMapsLoaderService,
	HubstaffTokenInterceptor,
	LanguageInterceptor,
	SentryErrorHandler,
	serverConnectionFactory,
	ServerConnectionService,
	Store,
	TenantInterceptor,
	TokenInterceptor
} from '@gauzy/ui-core/core';
import { CommonModule } from '@gauzy/ui-core/common';
import { HttpLoaderFactory, I18nModule, I18nService } from '@gauzy/ui-core/i18n';
import { SharedModule, TimeTrackerModule, dayOfWeekAsString } from '@gauzy/ui-core/shared';
import { ThemeModule } from '@gauzy/ui-core/theme';
import { AppComponent } from './app.component';
import { appRoutes } from './app.routes';
import { AppModuleGuard } from './app.module.guard';
import { initializeSentry } from './sentry';

// Initialize Sentry
if (environment.SENTRY_DSN) {
	if (environment.SENTRY_DSN === 'DOCKER_SENTRY_DSN') {
		console.warn('You are running inside Docker but does not have SENTRY_DSN env set');
	} else {
		console.log(`Enabling Sentry with DSN: ${environment.SENTRY_DSN}`);
		initializeSentry();
	}
}

// Is production mode?
const isProd = environment.production;

// Router config
const config: ExtraOptions = {
	useHash: true
};

// NB Modules
const NB_MODULES = [
	NbCalendarModule,
	NbCalendarKitModule,
	NbSidebarModule.forRoot(),
	NbMenuModule.forRoot(),
	NbDatepickerModule.forRoot(),
	NbDialogModule.forRoot(),
	NbWindowModule.forRoot(),
	NbToastrModule.forRoot(),
	NbChatModule.forRoot({ messageGoogleMapKey: environment.CHAT_MESSAGE_GOOGLE_MAP }),
	NbEvaIconsModule
];

// Third Party Modules
const THIRD_PARTY_MODULES = [
	isProd ? [] : AkitaNgDevtools,
	FeatureToggleModule,
	FileUploadModule,
	NgxPermissionsModule.forRoot(),
	TranslateModule.forRoot({
		loader: {
			provide: TranslateLoader,
			useFactory: HttpLoaderFactory,
			deps: [HttpClient]
		}
	})
];

// Feature Modules
const FEATURE_MODULES = [
	ThemeModule.forRoot(),
	UiCoreModule.forRoot(),
	CommonModule.forRoot(),
	CoreModule.forRoot(),
	SharedModule.forRoot(),
	TimeTrackerModule.forRoot(),
	I18nModule.forRoot()
];

@NgModule({
	declarations: [AppComponent],
	bootstrap: [AppComponent],
	imports: [
		BrowserModule,
		BrowserAnimationsModule,
		RouterModule.forRoot(appRoutes, config),
		...NB_MODULES,
		...FEATURE_MODULES,
		...THIRD_PARTY_MODULES
	],
	providers: [
		{
			provide: Sentry.TraceService,
			deps: [Router]
		},
		{ provide: APP_BASE_HREF, useValue: '/' },
		{
			provide: ErrorHandler,
			useClass: SentryErrorHandler
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: APIInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: HubstaffTokenInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: TokenInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: LanguageInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: TenantInterceptor,
			multi: true
		},
		ServerConnectionService,
		{
			provide: APP_INITIALIZER,
			useFactory: serverConnectionFactory,
			deps: [ServerConnectionService, Store, Router],
			multi: true
		},
		GoogleMapsLoaderService,
		{
			provide: APP_INITIALIZER,
			useFactory: googleMapsLoaderFactory,
			deps: [GoogleMapsLoaderService],
			multi: true
		},
		FeatureService,
		{
			provide: APP_INITIALIZER,
			useFactory: featureToggleLoaderFactory,
			deps: [FeatureService, Store],
			multi: true
		},
		AppInitService,
		{
			provide: APP_INITIALIZER,
			useFactory: initializeApp,
			deps: [AppInitService],
			multi: true
		},
		{
			provide: ErrorHandler,
			useClass: SentryErrorHandler
		},
		AppModuleGuard,
		ColorPickerService,
		CookieService,
		{
			provide: GAUZY_ENV,
			useValue: environment
		},
		provideHttpClient(withInterceptorsFromDi())
	]
})
export class AppModule {
	/**
	 * Constructor for the AppModule class.
	 *
	 * Initializes the _i18nService with all available languages.
	 * Sets Monday as the start of the week for the English locale in Moment.js.
	 *
	 * @param {I18nTranslateService} _i18nService - The I18nTranslateService instance.
	 */
	constructor(readonly _i18nService: I18nService) {
		console.log(`Angular Version: ${VERSION.full}`);

		// Initialize UI languages and Update Locale
		this.initializeUiLanguagesAndLocale();
	}

	/**
	 * Initialize UI languages and Update Locale
	 */
	private initializeUiLanguagesAndLocale(): void {
		// Set Monday as start of the week
		moment.updateLocale(LanguagesEnum.ENGLISH, {
			week: { dow: dayOfWeekAsString(WeekDaysEnum.MONDAY) },
			fallbackLocale: LanguagesEnum.ENGLISH
		});

		// Get the list of available languages from the LanguagesEnum
		const availableLanguages: LanguagesEnum[] = Object.values(LanguagesEnum);

		// Set the available languages in the translation service
		this._i18nService.setAvailableLanguages(availableLanguages);
	}
}

/**
 * Creates a function that initializes the app by calling the `init` method of the provided `AppInitService`.
 *
 * @param {AppInitService} provider - The `AppInitService` instance to initialize the app.
 * @return {() => Promise<void>} A function that returns a `Promise` that resolves when the app initialization is complete.
 */
export function initializeApp(provider: AppInitService): () => Promise<void> {
	return () => provider.init();
}

/**
 * Creates a function that loads the Google Maps API key using the provided GoogleMapsLoaderService.
 *
 * @param {GoogleMapsLoaderService} provider - The GoogleMapsLoaderService instance used to load the API key.
 * @return {Function} A function that loads the Google Maps API key by calling the provider's load method with the environment's Google Maps API key.
 */
export function googleMapsLoaderFactory(provider: GoogleMapsLoaderService): Function {
	return () => provider.load(environment.GOOGLE_MAPS_API_KEY);
}

/**
 * Creates a function that loads the feature toggle definitions using the provided FeatureService and stores them in the provided Store.
 *
 * @param {FeatureService} provider - The FeatureService instance used to load the feature toggle definitions.
 * @param {Store} store - The Store instance used to store the loaded feature toggle definitions.
 * @return {Function} A function that loads the feature toggle definitions by calling the provider's getFeatureToggleDefinition method and storing the result in the store.
 */
export function featureToggleLoaderFactory(provider: FeatureService, store: Store): Function {
	return () =>
		provider
			.getFeatureToggleDefinition()
			.then((features: IFeatureToggle[]) => {
				store.featureToggles = features || [];
				return features;
			})
			.catch(() => {});
}
