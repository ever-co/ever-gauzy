import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import {
	APP_INITIALIZER,
	ErrorHandler,
	enableProdMode,
	importProvidersFrom,
	inject,
	provideAppInitializer,
	provideZoneChangeDetection
} from '@angular/core';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { akitaConfig, enableAkitaProdMode, persistState } from '@datorama/akita';
import {
	APIInterceptor,
	AgentDashboardModule,
	AlwaysOnModule,
	AuthModule,
	AuthService,
	AuthStrategy,
	DEFAULT_TIMEOUT,
	ElectronService,
	ErrorHandlerService,
	GAUZY_ENV,
	GauzyStorageService,
	LanguageInterceptor,
	LanguageModule,
	LoggerService,
	NgxDesktopThemeModule,
	NgxLoginModule,
	OrganizationInterceptor,
	RefreshTokenInterceptor,
	ServerConnectionService,
	ServerDashboardModule,
	ServerDownModule,
	ServerErrorInterceptor,
	Store,
	TenantInterceptor,
	TimeoutInterceptor,
	TokenInterceptor
} from '@gauzy/desktop-ui-lib';
import { environment as gauzyEnvironment } from '@gauzy/ui-config';
import { provideI18n } from '@gauzy/ui-core/i18n';
import {
	NbButtonModule,
	NbCardModule,
	NbDatepickerModule,
	NbDialogModule,
	NbDialogService,
	NbLayoutModule,
	NbSidebarModule,
	NbSidebarService,
	NbThemeModule,
	NbToastrModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import * as Sentry from '@sentry/angular';
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

bootstrapApplication(AppComponent, {
	providers: [
		provideZoneChangeDetection(),
		importProvidersFrom(
			NbLayoutModule,
			AuthModule,
			NbDialogModule.forRoot(),
			NbToastrModule.forRoot(),
			NbCardModule,
			NbButtonModule,
			BrowserModule,
			AppRoutingModule,
			NbThemeModule,
			NbSidebarModule.forRoot(),
			NgxDesktopThemeModule,
			NgxLoginModule,
			ServerDashboardModule,
			NgSelectModule,
			ServerDownModule,
			LanguageModule.forRoot(),
			NbDatepickerModule.forRoot(),
			AgentDashboardModule,
			AlwaysOnModule
		),
		provideI18n({ extend: true }),
		AppService,
		NbDialogService,
		NbSidebarService,
		AuthStrategy,
		AuthService,
		ServerConnectionService,
		ElectronService,
		LoggerService,
		Store,
		provideAppInitializer(() => {
			const storage = inject(GauzyStorageService);
			persistState({
				key: '_gauzyStore',
				enableInNonBrowser: true,
				storage
			});
			akitaConfig({
				resettable: true
			});
		}),
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
		{
			provide: HTTP_INTERCEPTORS,
			useClass: ServerErrorInterceptor,
			multi: true
		},
		{
			provide: ErrorHandler,
			useClass: ErrorHandlerService
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
		{
			provide: APP_INITIALIZER,
			useFactory: () => () => {},
			deps: [Sentry.TraceService],
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
})
	.then(() => console.log(`Bootstrap Success!`))
	.catch((error) => console.error(error));
