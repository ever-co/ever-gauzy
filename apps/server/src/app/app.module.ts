import { BrowserModule } from '@angular/platform-browser';
import { APP_INITIALIZER, ErrorHandler, NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import {
	NbDialogModule,
	NbThemeModule,
	NbToastrModule,
	NbDialogService,
	NbLayoutModule,
	NbMenuModule,
	NbSidebarModule
} from '@nebular/theme';
import * as Sentry from '@sentry/angular-ivy';
import {
	UpdaterModule,
	SettingsModule,
	SetupModule,
	ServerDashboardModule,
	ElectronService,
	LoggerService,
	AboutModule,
	GAUZY_ENV
} from '@gauzy/desktop-ui-lib';
import { NbCardModule, NbButtonModule } from '@nebular/theme';
import { environment as gauzyEnvironment } from '@gauzy/ui-config';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { AppService } from './app.service';
import { environment } from '../environments/environment';
import { initializeSentry } from './sentry';

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
		HttpClientModule,
		SettingsModule,
		UpdaterModule,
		ServerDashboardModule,
		AboutModule
	],
	providers: [
		AppService,
		HttpClientModule,
		NbDialogService,
		ElectronService,
		LoggerService,
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
		{
			provide: GAUZY_ENV,
			useValue: {
				...gauzyEnvironment,
				...environment
			}
		}
	],
	bootstrap: [AppComponent]
})
export class AppModule {
	constructor() {}
}
