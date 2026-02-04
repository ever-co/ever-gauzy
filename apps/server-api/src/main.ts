import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { enableProdMode, ErrorHandler, importProvidersFrom, inject, provideAppInitializer } from '@angular/core';
import { bootstrapApplication, BrowserModule } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Router, RouterModule } from '@angular/router';
import {
	AboutModule,
	ElectronService,
	GAUZY_ENV,
	LanguageModule,
	LoggerService,
	NgxDesktopThemeModule,
	PluginsModule,
	ServerDashboardModule,
	SettingsModule,
	SetupModule
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
import * as Sentry from '@sentry/angular';
import { AppRoutingModule } from './app/app-routing.module';
import { AppComponent } from './app/app.component';
import { AppService } from './app/app.service';
import { initializeSentry } from './app/sentry';
import { environment } from './environments/environment';

if (environment.production) {
	enableProdMode();
}

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
			NbMenuModule.forRoot(),
			NbSidebarModule.forRoot(),
			SetupModule,
			SettingsModule,
			ServerDashboardModule,
			AboutModule,
			LanguageModule.forRoot(),
			PluginsModule
		),
		AppService,
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
		provideAppInitializer(() => {
			const initializerFn = ((trace: Sentry.TraceService) => () => {})(inject(Sentry.TraceService));
			return initializerFn();
		}),
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
}).catch((err) => console.error(err));
