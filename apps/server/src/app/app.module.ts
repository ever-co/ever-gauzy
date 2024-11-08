import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { APP_INITIALIZER, ErrorHandler, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Router, RouterModule } from '@angular/router';
import {
	AboutModule,
	ElectronService,
	GAUZY_ENV,
	LanguageModule,
	LoggerService,
	ServerDashboardModule,
	SettingsModule,
	SetupModule,
	UpdaterModule,
	NgxDesktopThemeModule
} from '@gauzy/desktop-ui-lib';
import { environment as gauzyEnvironment } from '@gauzy/ui-config';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbDialogService,
	NbLayoutModule,
	NbMenuModule,
	NbSidebarModule,
	NbThemeModule,
	NbToastrModule
} from '@nebular/theme';
import * as Sentry from '@sentry/angular-ivy';
import { environment } from '../environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AppService } from './app.service';
import { initializeSentry } from './sentry';

if (environment.SENTRY_DSN) {
	if (environment.SENTRY_DSN === 'DOCKER_SENTRY_DSN') {
		console.warn('You are running inside Docker but does not have SENTRY_DSN env set');
	} else {
		console.log(`Enabling Sentry with DSN: ${environment.SENTRY_DSN}`);
		initializeSentry();
	}
}

@NgModule({ declarations: [AppComponent],
    bootstrap: [AppComponent], imports: [NbLayoutModule,
        NbDialogModule.forRoot(),
        NbToastrModule.forRoot(),
        NbCardModule,
        NbButtonModule,
        BrowserModule,
        BrowserAnimationsModule,
        RouterModule,
        AppRoutingModule,
        NbThemeModule,
        NgxDesktopThemeModule,
        NbMenuModule.forRoot(),
        NbSidebarModule.forRoot(),
        SetupModule,
        SettingsModule,
        UpdaterModule,
        ServerDashboardModule,
        AboutModule,
        LanguageModule.forRoot()], providers: [
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
            useFactory: () => () => { },
            deps: [Sentry.TraceService],
            multi: true
        },
        {
            provide: GAUZY_ENV,
            useValue: {
                ...gauzyEnvironment,
                ...environment
            }
        },
        provideHttpClient(withInterceptorsFromDi())
    ] })
export class AppModule {
	constructor() { }
}
