import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import {
	enableProdMode,
	ErrorHandler,
	importProvidersFrom,
	inject,
	Injector,
	provideAppInitializer
} from '@angular/core';
import { bootstrapApplication, BrowserModule } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { akitaConfig, enableAkitaProdMode, persistState } from '@datorama/akita';
import {
	AboutModule,
	ActivityWatchInterceptor,
	ActivityWatchModule,
	AlwaysOnModule,
	APIInterceptor,
	AuthGuard,
	AuthModule,
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
	NgxLoginModule,
	NoAuthGuard,
	OrganizationInterceptor,
	PluginsModule,
	RecapModule,
	RefreshTokenInterceptor,
	serverConnectionFactory,
	ServerConnectionService,
	ServerDownModule,
	ServerErrorInterceptor,
	SettingsModule,
	SetupModule,
	SplashScreenModule,
	Store,
	TaskTableModule,
	TenantInterceptor,
	TimeoutInterceptor,
	TimeTrackerModule,
	TokenInterceptor
} from '@gauzy/desktop-ui-lib';
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
import { NgSelectModule } from '@ng-select/ng-select';
import * as Sentry from '@sentry/angular';
import { environment as gauzyEnvironment } from '@gauzy/ui-config';
import { provideI18n } from '@gauzy/ui-core/i18n';
import { AppRoutingModule } from './app/app-routing.module';
import { AppComponent } from './app/app.component';
import { AppModuleGuard } from './app/app.module.guards';
import { AppService } from './app/app.service';
import { initializeSentry } from './app/sentry';
import { environment } from './environments/environment';

if (environment.production) {
	enableProdMode();
	enableAkitaProdMode();
}

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
			AuthModule,
			NbDialogModule.forRoot(),
			NbToastrModule.forRoot(),
			NbCardModule,
			NbButtonModule,
			BrowserModule,
			AppRoutingModule,
			NbThemeModule,
			NgxDesktopThemeModule,
			NgxLoginModule,
			SetupModule,
			TimeTrackerModule,
			SettingsModule,
			ImageViewerModule,
			NgSelectModule,
			SplashScreenModule,
			ServerDownModule,
			AlwaysOnModule,
			LanguageModule.forRoot(),
			NbDatepickerModule.forRoot(),
			AboutModule,
			ActivityWatchModule,
			RecapModule,
			TaskTableModule,
			PluginsModule
		),
		provideI18n({ extend: true }),
		AppService,
		NbDialogService,
		AuthGuard,
		NoAuthGuard,
		AppModuleGuard,
		AuthStrategy,
		AuthService,
		ServerConnectionService,
		ElectronService,
		LoggerService,
		Store,
		{
			provide: HTTP_INTERCEPTORS,
			useClass: TokenInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: TenantInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: ActivityWatchInterceptor,
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
			useClass: RefreshTokenInterceptor,
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
		provideAppInitializer(() => {
			const initializerFn = serverConnectionFactory(
				inject(ServerConnectionService),
				inject(Store),
				inject(Router),
				inject(Injector)
			);
			return initializerFn();
		}),
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
