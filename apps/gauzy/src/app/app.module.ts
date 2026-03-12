// Some of the code is modified from https://github.com/akveo/ngx-admin/blob/master/src/app/app.module.ts,
// that licensed under the MIT License and Copyright (c) 2017 akveo.com.

import { APP_BASE_HREF } from '@angular/common';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { NgModule, ErrorHandler, VERSION, inject, provideAppInitializer } from '@angular/core';
import { ExtraOptions, Router, RouterModule } from '@angular/router';
import { OVERLAY_DEFAULT_CONFIG } from '@angular/cdk/overlay';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
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
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { FileUploadModule } from 'ng2-file-upload';
import { CookieService } from 'ngx-cookie-service';
import { FeatureToggleModule } from 'ngx-feature-toggle';
import { NgxPermissionsModule } from 'ngx-permissions';
import { ColorPickerService } from 'ngx-color-picker';
// V9 Migration: @sentry/angular-ivy was removed, use @sentry/angular instead
// Reference: https://docs.sentry.io/platforms/javascript/migration/v8-to-v9/
import * as Sentry from '@sentry/angular';
import * as moment from 'moment';
import { IFeatureToggle, LanguagesEnum } from '@gauzy/contracts';
import { getPluginUiConfig } from '@gauzy/plugin-ui';
import { PostHogModule } from '@gauzy/plugin-posthog-ui';
import { GAUZY_ENV, environment } from '@gauzy/ui-config';
import { UiCoreModule } from '@gauzy/ui-core';
import { CommonModule } from '@gauzy/ui-core/common';
import {
	APIInterceptor,
	AppInitService,
	AuthRefreshInterceptor,
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
	TokenInterceptor,
	WorkspaceSyncService
} from '@gauzy/ui-core/core';
import { I18nModule, I18nService } from '@gauzy/ui-core/i18n';
import { SharedModule, TimeTrackerModule } from '@gauzy/ui-core/shared';
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

if (environment.POSTHOG_ENABLED && environment.POSTHOG_KEY) {
	if (environment.POSTHOG_KEY === 'DOCKER_POSTHOG_KEY') {
		console.warn('You are running inside Docker but does not have POSTHOG_KEY env set');
	} else {
		console.log(`Enabling PostHog with API Key: ${environment.POSTHOG_KEY}`);
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
	NbChatModule.forRoot({ messageGoogleMapKey: environment.CHAT_MESSAGE_GOOGLE_MAP })
];

// Third Party Modules
const THIRD_PARTY_MODULES = [
	...(isProd ? [] : [AkitaNgDevtools]),
	FeatureToggleModule,
	FileUploadModule,
	NgxPermissionsModule.forRoot(),
	PostHogModule.forRoot({
		apiKey: environment.POSTHOG_KEY || '',
		options: {
			api_host: environment.POSTHOG_HOST,
			capture_pageview: environment.POSTHOG_ENABLED
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

// HTTP Interceptors
const HTTP_INTERCEPTOR_PROVIDERS = [
	// Prepends the API base URL and common headers to every outgoing HTTP request.
	{ provide: HTTP_INTERCEPTORS, useClass: APIInterceptor, multi: true },

	// Attaches Hubstaff OAuth tokens to requests targeting the Hubstaff integration.
	{ provide: HTTP_INTERCEPTORS, useClass: HubstaffTokenInterceptor, multi: true },

	// Attaches the JWT access token to authenticated API requests.
	{ provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },

	// Injects the active UI language into the Accept-Language request header.
	{ provide: HTTP_INTERCEPTORS, useClass: LanguageInterceptor, multi: true },

	// Injects the active tenant ID into requests that require tenant scoping.
	{ provide: HTTP_INTERCEPTORS, useClass: TenantInterceptor, multi: true },

	// Silently refreshes the JWT access token when a 401 response is received.
	{ provide: HTTP_INTERCEPTORS, useClass: AuthRefreshInterceptor, multi: true }
];

@NgModule({
	declarations: [AppComponent],
	exports: [AppComponent],
	imports: [
		BrowserModule,
		BrowserAnimationsModule,
		RouterModule.forRoot(appRoutes, config),
		...NB_MODULES,
		...FEATURE_MODULES,
		...THIRD_PARTY_MODULES
	],
	providers: [
		// ─── Configuration Tokens ────────────────────────────────────────────────────
		// Sets the base href for all router links and location strategies.
		{ provide: APP_BASE_HREF, useValue: '/' },

		// Exposes the full environment config to the DI tree via the GAUZY_ENV token.
		{ provide: GAUZY_ENV, useValue: environment },

		// Angular CDK 21 enables the Popover API for overlays by default (top layer), which causes
		// Nebular dialogs to render above toasts. Disabling it restores z-index-based stacking.
		{ provide: OVERLAY_DEFAULT_CONFIG, useValue: { usePopover: false } },

		// ─── Error Handling & Tracing ─────────────────────────────────────────────────
		// Routes unhandled errors to Sentry instead of the default console handler.
		{ provide: ErrorHandler, useClass: SentryErrorHandler },

		// Required by @sentry/angular to instrument Angular router navigation events.
		{ provide: Sentry.TraceService, deps: [Router] },

		// ─── HTTP Interceptors ────────────────────────────────────────────────────────
		...HTTP_INTERCEPTOR_PROVIDERS,

		ServerConnectionService,
		provideAppInitializer(() => {
			const initializerFn = serverConnectionFactory(
				inject(ServerConnectionService),
				inject(Store),
				inject(Router)
			);
			return initializerFn();
		}),
		GoogleMapsLoaderService,
		provideAppInitializer(() => {
			const initializerFn = googleMapsLoaderFactory(inject(GoogleMapsLoaderService));
			return initializerFn();
		}),
		FeatureService,
		provideAppInitializer(() => {
			const initializerFn = featureToggleLoaderFactory(inject(FeatureService), inject(Store));
			return initializerFn();
		}),
		AppInitService,
		provideAppInitializer(() => {
			const initializerFn = initializeApp(inject(AppInitService));
			return initializerFn();
		}),

		provideAppInitializer(() => {
			const workspaceSyncService = inject(WorkspaceSyncService);
			workspaceSyncService.isSupported();
			return Promise.resolve();
		}),
		{
			provide: ErrorHandler,
			useClass: SentryErrorHandler
		},
		// ─── Services ─────────────────────────────────────────────────────────────────
		// Guards that protect app-level routes requiring authenticated/authorized access.
		AppModuleGuard,

		// Provides the ngx-color-picker singleton for use across the application.
		ColorPickerService,

		// Provides the ngx-cookie-service singleton for reading and writing browser cookies.
		CookieService,

		// ─── Framework Providers ──────────────────────────────────────────────────────
		// Configures HttpClient to pick up class-based HTTP_INTERCEPTORS from DI.
		provideHttpClient(withInterceptorsFromDi()),

		// Registers all Chart.js defaults so ng2-charts charts render without manual imports.
		provideCharts(withDefaultRegisterables())
	]
})
export class AppModule {
	private readonly _i18nService = inject(I18nService);

	constructor() {
		console.log(`Angular Version: ${VERSION.full}`);

		// Initialize UI languages and Update Locale
		this.initializeUiLanguagesAndLocale();
	}

	/**
	 * Initialize UI languages and Update Locale using `plugin-ui.config.ts`.
	 */
	private initializeUiLanguagesAndLocale(): void {
		const uiConfig = getPluginUiConfig();

		const localeOptions: moment.LocaleSpecification = {};
		const dow = uiConfig.startWeekOn;

		// Validate the day of the week number (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
		if (typeof dow === 'number' && dow >= 0 && dow <= 6) {
			localeOptions.week = { dow };
		}

		/** Update the locale with the default language. */
		moment.updateLocale(uiConfig.defaultLanguage, localeOptions);

		// Set current locale with fallback chain (moment.locale accepts string[] for fallback)
		const fallbackLocale = uiConfig.fallbackLocale ?? uiConfig.defaultLanguage;
		moment.locale([uiConfig.defaultLanguage, fallbackLocale]);

		// Set available languages from the UI plugin configuration (validate against LanguagesEnum)
		const validLanguages = new Set<string>(Object.values(LanguagesEnum));
		const validatedLanguages = (uiConfig.availableLanguages ?? []).filter((lang): lang is LanguagesEnum =>
			validLanguages.has(lang)
		);

		this._i18nService.setAvailableLanguages(validatedLanguages);
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
