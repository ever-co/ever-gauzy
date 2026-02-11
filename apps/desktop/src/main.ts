import { enableProdMode, ErrorHandler, importProvidersFrom, inject, provideAppInitializer } from '@angular/core';
import { bootstrapApplication, BrowserModule } from '@angular/platform-browser';
import { akitaConfig, enableAkitaProdMode, persistState } from '@datorama/akita';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Router, RouterModule } from '@angular/router';
import {
	NbButtonModule,
	NbCardModule,
	NbDatepickerModule,
	NbDialogModule,
	NbDialogService,
	NbLayoutModule,
	NbThemeModule,
	NbToastrModule
} from '@nebular/theme';
import * as Sentry from '@sentry/angular';
import {
	AboutModule,
	ActivityWatchInterceptor,
	AlwaysOnModule,
	APIInterceptor,
	AuthGuard,
	AuthService,
	AuthStrategy,
	DEFAULT_TIMEOUT,
	ElectronService,
	ErrorHandlerService,
	GAUZY_ENV,
	ImageViewerModule,
	LanguageInterceptor,
	LanguageModule,
	LoggerService,
	NgxDesktopThemeModule,
	NoAuthGuard,
	OrganizationInterceptor,
	PluginsModule,
	RecapModule,
	RefreshTokenInterceptor,
	ServerErrorInterceptor,
	SettingsModule,
	SetupModule,
	Store,
	TenantInterceptor,
	TimeoutInterceptor,
	TimeTrackerModule,
	TokenInterceptor
} from '@gauzy/desktop-ui-lib';
import { environment as gauzyEnvironment } from '@gauzy/ui-config';
import { provideI18n } from '@gauzy/ui-core/i18n';
import { AppRoutingModule } from './app/app-routing.module';
import { AppComponent } from './app/app.component';
import { AppService } from './app/app.service';
import { initializeSentry } from './app/sentry';
import { environment } from './environments/environment';

if (environment.production) {
	enableProdMode();
	enableAkitaProdMode();
}

/**
 * Initializes Sentry based on the environment configuration.
 * If a valid Sentry DSN is provided, Sentry is initialized with the specified configuration.
 * If the DSN is set to 'DOCKER_SENTRY_DSN', a warning is logged indicating that the environment
 * is running inside Docker without a Sentry DSN.
 */
if (environment.SENTRY_DSN) {
	if (environment.SENTRY_DSN === 'DOCKER_SENTRY_DSN') {
		console.warn('You are running inside Docker but does not have SENTRY_DSN env set');
	} else {
		console.log(`Enabling Sentry with DSN: ${environment.SENTRY_DSN}`);
		initializeSentry();
	}
}

persistState({
	key: '_gauzyStore'
});

akitaConfig({
	resettable: true
});

bootstrapApplication(AppComponent, {
	providers: [
		importProvidersFrom(
			NbLayoutModule,
			NbDialogModule.forRoot(),
			NbToastrModule.forRoot(),
			NbCardModule,
			NbButtonModule,
			BrowserModule,
			RouterModule,
			AppRoutingModule,
			NbThemeModule,
			NgxDesktopThemeModule,
			SetupModule,
			TimeTrackerModule,
			SettingsModule,
			ImageViewerModule,
			NbDatepickerModule.forRoot(),
			LanguageModule.forRoot(),
			AboutModule,
			AlwaysOnModule,
			RecapModule,
			PluginsModule
		),
		provideI18n({ extend: true }),
		AppService,
		NbDialogService,
		ElectronService,
		LoggerService,
		AuthGuard,
		NoAuthGuard,
		AuthStrategy,
		AuthService,
		Store,
		{
			provide: HTTP_INTERCEPTORS,
			useClass: TokenInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: RefreshTokenInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: TenantInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: OrganizationInterceptor,
			multi: true
		},
		{
			provide: ErrorHandler,
			useValue: Sentry.createErrorHandler({
				showDialog: true
			})
		},
		{
			provide: Sentry.TraceService,
			deps: [Router]
		},
		provideAppInitializer(() => {
			const initializerFn = ((trace: Sentry.TraceService) => () => {})(inject(Sentry.TraceService));
			return initializerFn();
		}),
		{
			provide: ErrorHandler,
			useClass: ErrorHandlerService
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: ServerErrorInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: ActivityWatchInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: APIInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: LanguageInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: TimeoutInterceptor,
			multi: true
		},
		{ provide: DEFAULT_TIMEOUT, useValue: 80000 },
		{
			provide: GAUZY_ENV,
			useValue: {
				...gauzyEnvironment,
				...environment
			}
		},
		provideHttpClient(withInterceptorsFromDi()),
		provideAnimations()
	]
}).catch((error) => console.error(error));
