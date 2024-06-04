// Some of the code is modified from https://github.com/akveo/ngx-admin/blob/master/src/app/app.module.ts,
// that licensed under the MIT License and Copyright (c) 2017 akveo.com.

import { APP_BASE_HREF } from '@angular/common';
import { Router } from '@angular/router';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule, APP_INITIALIZER, ErrorHandler } from '@angular/core';
import { HttpClientModule, HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { AkitaNgDevtools } from '@datorama/akita-ngdevtools';
import {
	NbChatModule,
	NbDatepickerModule,
	NbDialogModule,
	NbMenuModule,
	NbSidebarModule,
	NbToastrModule,
	NbWindowModule,
	NbCalendarModule,
	NbCalendarKitModule
} from '@nebular/theme';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { CloudinaryModule } from '@cloudinary/ng';
import { FileUploadModule } from 'ng2-file-upload';
import { CookieService } from 'ngx-cookie-service';
import { FeatureToggleModule } from 'ngx-feature-toggle';
import { NgxPermissionsModule } from 'ngx-permissions';
import { ColorPickerService } from 'ngx-color-picker';
import * as Sentry from '@sentry/angular-ivy';
import moment from 'moment';
import { UiSdkModule } from '@gauzy/ui-sdk';
import { UiConfigModule } from '@gauzy/ui-config';
import { IFeatureToggle, LanguagesEnum, WeekDaysEnum } from '@gauzy/contracts';
import {
	APIInterceptor,
	AppInitService,
	FeatureService,
	GoogleMapsLoaderService,
	HubstaffTokenInterceptor,
	LanguageInterceptor,
	ServerConnectionService,
	TenantInterceptor,
	TokenInterceptor
} from '@gauzy/ui-sdk/core';
import { Store } from '@gauzy/ui-sdk/common';
import { GAUZY_ENV, environment } from '@gauzy/ui-config';
import { HttpLoaderFactory } from '@gauzy/ui-sdk/i18n';
import { CoreModule } from './@core/core.module';
import { ThemeModule } from './@theme/theme.module';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { AppModuleGuard } from './app.module.guards';
import { DangerZoneMutationModule } from './@shared/settings/danger-zone-mutation.module';
import { SentryErrorHandler } from './@core/sentry-error.handler';
import { TimeTrackerModule } from './@shared/time-tracker/time-tracker.module';
import { SharedModule } from './@shared/shared.module';
import { EstimateEmailModule } from './auth/estimate-email/estimate-email.module';
import { LegalModule } from './legal/legal.module';
import { dayOfWeekAsString } from './@theme/components/header/selectors/date-range-picker';
import { initializeSentry } from './sentry';

if (environment.SENTRY_DSN) {
	if (environment.SENTRY_DSN === 'DOCKER_SENTRY_DSN') {
		console.warn('You are running inside Docker but does not have SENTRY_DSN env set');
	} else {
		console.log(`Enabling Sentry with DSN: ${environment.SENTRY_DSN}`);
		initializeSentry();
	}
}

const isProd = environment.production;

@NgModule({
	declarations: [AppComponent],
	imports: [
		LegalModule,
		EstimateEmailModule,
		BrowserModule,
		BrowserAnimationsModule,
		HttpClientModule,
		DangerZoneMutationModule,
		AppRoutingModule,
		NbCalendarModule,
		NbCalendarKitModule,
		NbSidebarModule.forRoot(),
		NbMenuModule.forRoot(),
		NbDatepickerModule.forRoot(),
		NbDialogModule.forRoot(),
		NbWindowModule.forRoot(),
		NbToastrModule.forRoot(),
		NbChatModule.forRoot({
			messageGoogleMapKey: environment.CHAT_MESSAGE_GOOGLE_MAP
		}),
		NbEvaIconsModule,
		CoreModule.forRoot(),
		UiConfigModule.forRoot(),
		UiSdkModule.forRoot(),
		ThemeModule.forRoot(),
		TranslateModule.forRoot({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		CloudinaryModule,
		FileUploadModule,
		TimeTrackerModule.forRoot(),
		isProd ? [] : AkitaNgDevtools,
		SharedModule.forRoot(),
		FeatureToggleModule,
		NgxPermissionsModule.forRoot()
	],
	bootstrap: [AppComponent],
	providers: [
		{
			provide: Sentry.TraceService,
			deps: [Router]
		},
		{ provide: APP_BASE_HREF, useValue: '/' },
		{
			provide: ErrorHandler,
			useClass: SentryErrorHandler
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: APIInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: HubstaffTokenInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: TokenInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: LanguageInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: TenantInterceptor,
			multi: true
		},
		ServerConnectionService,
		{
			provide: APP_INITIALIZER,
			useFactory: serverConnectionFactory,
			deps: [ServerConnectionService, Store, Router],
			multi: true
		},
		GoogleMapsLoaderService,
		{
			provide: APP_INITIALIZER,
			useFactory: googleMapsLoaderFactory,
			deps: [GoogleMapsLoaderService],
			multi: true
		},
		FeatureService,
		{
			provide: APP_INITIALIZER,
			useFactory: featureToggleLoaderFactory,
			deps: [FeatureService, Store],
			multi: true
		},
		{
			provide: APP_INITIALIZER,
			useFactory: (appInitService: AppInitService) => () => {
				return appInitService.init();
			},
			deps: [AppInitService],
			multi: true
		},
		{
			provide: ErrorHandler,
			useClass: SentryErrorHandler
		},
		AppModuleGuard,
		ColorPickerService,
		CookieService,
		{
			provide: GAUZY_ENV,
			useValue: environment
		}
	]
})
export class AppModule {
	constructor() {
		// Set Monday as start of the week
		moment.updateLocale(LanguagesEnum.ENGLISH, {
			week: {
				dow: dayOfWeekAsString(WeekDaysEnum.MONDAY)
			},
			fallbackLocale: LanguagesEnum.ENGLISH
		});
	}
}

/**
 *
 * @param provider
 * @param store
 * @param router
 * @returns
 */
export function serverConnectionFactory(provider: ServerConnectionService, store: Store, router: Router) {
	return () => {
		const url = environment.API_BASE_URL;
		console.log('Checking server connection in serverConnectionFactory on URL: ', url);

		return provider
			.checkServerConnection(url)
			.finally(() => {
				console.log(
					`Server connection status in serverConnectionFactory for Url ${url} is: ${store.serverConnection}`
				);

				if (store.serverConnection !== 200) {
					router.navigate(['server-down']);
				}
			})
			.catch((err) => {
				console.error(`Error checking server connection in serverConnectionFactory for URL: ${url}`, err);
			});
	};
}

/**
 *
 * @param provider
 * @returns
 */
export function googleMapsLoaderFactory(provider: GoogleMapsLoaderService) {
	return () => provider.load(environment.GOOGLE_MAPS_API_KEY);
}

/**
 *
 * @param provider
 * @param store
 * @returns
 */
export function featureToggleLoaderFactory(provider: FeatureService, store: Store) {
	return () =>
		provider
			.getFeatureToggleDefinition()
			.then((features: IFeatureToggle[]) => {
				store.featureToggles = features || [];
				return features;
			})
			.catch(() => {});
}
