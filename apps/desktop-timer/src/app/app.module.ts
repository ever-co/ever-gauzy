import { BrowserModule } from '@angular/platform-browser';
import { NgModule, APP_INITIALIZER, ErrorHandler } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import {
	NbDialogModule,
	NbThemeModule,
	NbToastrModule,
	NbDialogService,
	NbLayoutModule,
	NbDatepickerModule
} from '@nebular/theme';
import { NgxElectronModule } from 'ngx-electron';
import { AppService } from './app.service';
import {
	HttpClientModule,
	HTTP_INTERCEPTORS,
	HttpClient
} from '@angular/common/http';
import {
	NgxLoginModule,
	ImageViewerModule,
	UpdaterModule,
	SettingsModule,
	ScreenCaptureModule,
	TimeTrackerModule,
	SetupModule,
	SplashScreenModule,
	ElectronService,
	AboutModule,
	LoggerService,
	AuthModule,
	AuthGuard,
	AuthService,
	AuthStrategy,
	ErrorHandlerService,
	NoAuthGuard,
	ServerConnectionService,
	ServerErrorInterceptor,
	Store,
	TenantInterceptor,
	TokenInterceptor,
	serverConnectionFactory,
	ServerDownModule,
} from '@gauzy/desktop-ui-lib';
import { NbCardModule, NbButtonModule } from '@nebular/theme';
import { HttpLoaderFactory } from '../../../gauzy/src/app/@shared/translate/translate.module';
import { NgSelectModule } from '@ng-select/ng-select';
import { AppModuleGuard } from './app.module.guards';
import { Router } from '@angular/router';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import * as Sentry from '@sentry/angular-ivy';

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
		NbThemeModule.forRoot({ name: 'gauzy-light' }),
		NgxLoginModule,
		SetupModule,
		TimeTrackerModule,
		NgxElectronModule,
		HttpClientModule,
		ScreenCaptureModule,
		SettingsModule,
		UpdaterModule,
		ImageViewerModule,
		NgSelectModule,
		SplashScreenModule,
		ServerDownModule,
		TranslateModule.forRoot({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbDatepickerModule.forRoot(),
		AboutModule
	],
	providers: [
		AppService,
		HttpClientModule,
		NbDialogService,
		AuthGuard,
		NoAuthGuard,
		AppModuleGuard,
		AuthStrategy,
		AuthService,
		ServerConnectionService,
		ElectronService,
		LoggerService,
		{
			provide: ErrorHandler,
			useClass: ErrorHandlerService
		},
		{
			provide: APP_INITIALIZER,
			useFactory: serverConnectionFactory,
			deps: [ServerConnectionService, Store, Router],
			multi: true
		},
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
			useClass: ServerErrorInterceptor,
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
			useFactory: () => () => {},
			deps: [Sentry.TraceService],
			multi: true
		}
	],
	bootstrap: [AppComponent],
	exports: []
})
export class AppModule { }
