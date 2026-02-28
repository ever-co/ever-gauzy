import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import {
	enableProdMode,
	ErrorHandler,
	importProvidersFrom,
	inject,
	provideAppInitializer,
	provideZoneChangeDetection
} from '@angular/core';
import { bootstrapApplication, BrowserModule } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Router, RouterModule } from '@angular/router';
import {
	NbDialogModule,
	NbDialogService,
	NbMenuModule,
	NbSidebarModule,
	NbToastrModule,
	NbIconLibraries
} from '@nebular/theme';
import * as Sentry from '@sentry/angular';
import { akitaConfig, persistState } from '@datorama/akita';
import {
	ElectronService,
	GAUZY_ENV,
	GauzyStorageService,
	LanguageModule,
	LoggerService,
	NgxDesktopThemeModule,
	Store
} from '@gauzy/desktop-ui-lib';
import { environment as gauzyEnvironment } from '@gauzy/ui-config';
import { provideI18n } from '@gauzy/ui-core/i18n';
import { TablerIconsModule } from '@gauzy/ui-core/icons';
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
		provideZoneChangeDetection(),
		importProvidersFrom(
			NbDialogModule.forRoot(),
			NbToastrModule.forRoot(),
			BrowserModule,
			RouterModule,
			AppRoutingModule,
			NbMenuModule.forRoot(),
			NbSidebarModule.forRoot(),
			LanguageModule.forRoot(),
			TablerIconsModule,
			NgxDesktopThemeModule
		),
		provideI18n({ extend: true }),
		AppService,
		NbDialogService,
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
		provideAppInitializer(() => {
			const iconLibraries = inject(NbIconLibraries);

			iconLibraries.registerFontPack('font-awesome', {
				packClass: 'fas',
				iconClassPrefix: 'fa'
			});

			iconLibraries.setDefaultPack('eva');
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
