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
} from '@gauzy/desktop-ui-lib';
import { NbCardModule, NbButtonModule } from '@nebular/theme';
import { RouterModule } from '@angular/router';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { TokenInterceptor } from './interceptors/token.interceptor';
import * as Sentry from "@sentry/angular-ivy";
import { Router } from '@angular/router';

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
	],
	providers: [
		AppService,
		HttpClientModule,
		NbDialogService,
		ElectronService,
		LoggerService,
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
	],
	bootstrap: [AppComponent],
})
export class AppModule {
	constructor() { }
}
