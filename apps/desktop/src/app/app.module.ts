import { BrowserModule } from '@angular/platform-browser';
import { APP_INITIALIZER, ErrorHandler, NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import {
	NbDialogModule,
	NbThemeModule,
	NbToastrModule,
	NbDialogService,
	NbLayoutModule,
	NbDatepickerModule,
} from '@nebular/theme';
import { NgxElectronModule } from 'ngx-electron';
import { AppService } from './app.service';
import { HttpClientModule } from '@angular/common/http';
import {
	ImageViewerModule,
	UpdaterModule,
	SettingsModule,
	ScreenCaptureModule,
	TimeTrackerModule,
	SetupModule,
	ElectronService,
	LoggerService,
	AboutModule,
	TokenInterceptor,
	TenantInterceptor,
	ErrorHandlerService,
	ServerErrorInterceptor,
	APIInterceptor,
	TimeoutInterceptor,
	DEFAULT_TIMEOUT,
	AuthGuard,
	NoAuthGuard,
	AuthStrategy,
	AuthService,
	LanguageInterceptor,
	Store,
	AlwaysOnModule,
	GAUZY_ENV
} from '@gauzy/desktop-ui-lib';
import { NbCardModule, NbButtonModule } from '@nebular/theme';
import { RouterModule } from '@angular/router';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import * as Sentry from "@sentry/angular";
import { Router } from '@angular/router';
import { environment as gauzyEnvironment } from '@env/environment';
import { environment } from '../environments/environment';

@NgModule({
	declarations: [AppComponent],
	imports: [
		NbLayoutModule,
		NbDialogModule.forRoot(),
		NbToastrModule.forRoot(),
		NbCardModule,
		NbButtonModule,
		BrowserModule,
		BrowserAnimationsModule,
		RouterModule,
		AppRoutingModule,
		NbThemeModule.forRoot({ name: 'gauzy-light' }),
		SetupModule,
		TimeTrackerModule,
		NgxElectronModule,
		HttpClientModule,
		ScreenCaptureModule,
		SettingsModule,
		UpdaterModule,
		ImageViewerModule,
		NbDatepickerModule.forRoot(),
		AboutModule,
		AlwaysOnModule
	],
	providers: [
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
			multi: true,
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: TenantInterceptor,
			multi: true,
		},
		{
			provide: ErrorHandler,
			useValue: Sentry.createErrorHandler({
				showDialog: true,
			}),
		},
		{
			provide: Sentry.TraceService,
			deps: [Router],
		},
		{
			provide: APP_INITIALIZER,
			useFactory: () => () => { },
			deps: [Sentry.TraceService],
			multi: true,
		},
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
				...environment,
			},
		},
	],
	bootstrap: [AppComponent],
})
export class AppModule {
	constructor() { }
}
