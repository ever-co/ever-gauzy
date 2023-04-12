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
	NbMenuModule,
	NbSidebarModule,
} from '@nebular/theme';
import { NgxElectronModule } from 'ngx-electron';
import { AppService } from './app.service';
import { HttpClientModule } from '@angular/common/http';
import {
	UpdaterModule,
	SettingsModule,
	SetupModule,
	ServerDashboardModule,
	ElectronService,
	AboutModule,
} from '@gauzy/desktop-ui-lib';
import { NbCardModule, NbButtonModule } from '@nebular/theme';
import { RouterModule } from '@angular/router';
import * as Sentry from '@sentry/angular-ivy';
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
		NbMenuModule.forRoot(),
		NbSidebarModule.forRoot(),
		SetupModule,
		NgxElectronModule,
		HttpClientModule,
		SettingsModule,
		UpdaterModule,
		ServerDashboardModule,
		AboutModule,
	],
	providers: [
		AppService,
		HttpClientModule,
		NbDialogService,
		ElectronService,
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
		}
	],
	bootstrap: [AppComponent],
})
export class AppModule {
	constructor() { }
}
