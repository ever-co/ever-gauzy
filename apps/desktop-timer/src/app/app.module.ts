import { HTTP_INTERCEPTORS, HttpClient, HttpClientModule } from '@angular/common/http';
import { APP_INITIALIZER, ErrorHandler, Injector, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import {
	APIInterceptor,
	AboutModule,
	ActivityWatchInterceptor,
	ActivityWatchModule,
	AlwaysOnModule,
	AuthGuard,
	AuthModule,
	AuthService,
	AuthStrategy,
	DEFAULT_TIMEOUT,
	ElectronService,
	ErrorHandlerService,
	GAUZY_ENV,
	HttpLoaderFactory,
	ImageViewerModule,
	LanguageInterceptor,
	LanguageModule,
	LoggerService,
	NgxLoginModule,
	NoAuthGuard,
	OrganizationInterceptor,
	RecapModule,
	ScreenCaptureModule,
	ServerConnectionService,
	ServerDownModule,
	ServerErrorInterceptor,
	SettingsModule,
	SetupModule,
	SplashScreenModule,
	Store,
	TenantInterceptor,
	TimeTrackerModule,
	TimeoutInterceptor,
	TokenInterceptor,
	UnauthorizedInterceptor,
	UpdaterModule,
	serverConnectionFactory,
	NgxDesktopThemeModule
} from '@gauzy/desktop-ui-lib';
import { environment as gauzyEnvironment } from '@gauzy/ui-config';
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
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import * as Sentry from '@sentry/angular-ivy';
import { environment } from '../environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AppModuleGuard } from './app.module.guards';
import { AppService } from './app.service';
import { initializeSentry } from './sentry';

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

@NgModule({
	declarations: [AppComponent],
	imports: [
		NbLayoutModule,
		AuthModule,
		NbDialogModule.forRoot(),
		NbToastrModule.forRoot(),
		NbCardModule,
		NbButtonModule,
		BrowserModule,
		BrowserAnimationsModule,
		AppRoutingModule,
		NbThemeModule,
		NgxDesktopThemeModule,
		NgxLoginModule,
		SetupModule,
		TimeTrackerModule,
		HttpClientModule,
		ScreenCaptureModule,
		SettingsModule,
		UpdaterModule,
		ImageViewerModule,
		NgSelectModule,
		SplashScreenModule,
		ServerDownModule,
		AlwaysOnModule,
		TranslateModule.forRoot({
			extend: true,
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		LanguageModule.forRoot(),
		NbDatepickerModule.forRoot(),
		AboutModule,
		ActivityWatchModule,
		RecapModule
	],
	providers: [
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
			useClass: UnauthorizedInterceptor,
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
			provide: APP_INITIALIZER,
			useFactory: serverConnectionFactory,
			deps: [ServerConnectionService, Store, Router, Injector],
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
		{
			provide: APP_INITIALIZER,
			useFactory: () => () => { },
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
		}
	],
	bootstrap: [AppComponent],
	exports: []
})
export class AppModule { }
