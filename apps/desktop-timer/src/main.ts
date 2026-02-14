import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { enableProdMode, ErrorHandler, importProvidersFrom, inject, provideAppInitializer } from '@angular/core';
import { bootstrapApplication, BrowserModule } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { akitaConfig, enableAkitaProdMode, persistState } from '@datorama/akita';
import {
	ActivityWatchInterceptor,
	APIInterceptor,
	AuthService,
	AuthStrategy,
	DEFAULT_TIMEOUT,
	ElectronService,
	ErrorHandlerService,
	GAUZY_ENV,
	GauzyStorageService,
	LanguageInterceptor,
	LanguageModule,
	LoggerService,
	NgxDesktopThemeModule,
	OrganizationInterceptor,
	RefreshTokenInterceptor,
	ServerConnectionService,
	ServerErrorInterceptor,
	Store,
	TenantInterceptor,
	TimeoutInterceptor,
	TokenInterceptor
} from '@gauzy/desktop-ui-lib';
import { environment as gauzyEnvironment } from '@gauzy/ui-config';
import { provideI18n } from '@gauzy/ui-core/i18n';
import { TablerIconsModule } from '@gauzy/ui-core/icons';
import {
	NbDatepickerModule,
	NbDialogModule,
	NbDialogService,
	NbIconLibraries,
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

bootstrapApplication(AppComponent, {
	providers: [
		importProvidersFrom(
			BrowserModule,
			AppRoutingModule,
			NgxDesktopThemeModule, // Required for custom Gauzy themes and theme initializer
			NbDialogModule.forRoot(),
			NbToastrModule.forRoot(),
			NbThemeModule,
			NbSidebarModule.forRoot(), // Provides NbSidebarService
			NbMenuModule.forRoot(), // Provides NbMenuService
			TablerIconsModule,
			LanguageModule.forRoot(),
			NbDatepickerModule.forRoot()
		),
		provideI18n({ extend: true }),
		AppService,
		NbDialogService,
		AuthStrategy,
		AuthService,
		ServerConnectionService,
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
		// Register icon packs for Nebular
		provideAppInitializer(() => {
			const iconLibraries = inject(NbIconLibraries);

			iconLibraries.registerFontPack('font-awesome', {
				packClass: 'fas',
				iconClassPrefix: 'fa'
			});

			iconLibraries.setDefaultPack('eva');
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
