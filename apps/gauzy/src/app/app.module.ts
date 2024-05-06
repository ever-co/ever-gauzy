// Some of the code is modified from https://github.com/akveo/ngx-admin/blob/master/src/app/app.module.ts,
// that licensed under the MIT License and Copyright (c) 2017 akveo.com.

import { APP_BASE_HREF } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule, APP_INITIALIZER, ErrorHandler } from '@angular/core';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { CoreModule } from './@core/core.module';
import { ThemeModule } from './@theme/theme.module';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
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
import {
	APIInterceptor,
	HubstaffTokenInterceptor,
	LanguageInterceptor,
	TenantInterceptor,
	TokenInterceptor
} from './@core/interceptors';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { CloudinaryModule } from '@cloudinary/ng';
import { environment } from '@env/environment';
import { FileUploadModule } from 'ng2-file-upload';
import { ServerConnectionService } from './@core/services/server-connection.service';
import { Store } from './@core/services/store.service';
import { AppModuleGuard } from './app.module.guards';
import { DangerZoneMutationModule } from './@shared/settings/danger-zone-mutation.module';
import * as Sentry from '@sentry/angular-ivy';
import { SentryErrorHandler } from './@core/sentry-error.handler';
import { TimeTrackerModule } from './@shared/time-tracker/time-tracker.module';
import { SharedModule } from './@shared/shared.module';
import { AkitaNgDevtools } from '@datorama/akita-ngdevtools';
import { NgxPermissionsModule } from 'ngx-permissions';
import { ColorPickerService } from 'ngx-color-picker';
import { EstimateEmailModule } from './auth/estimate-email/estimate-email.module';
import * as moment from 'moment';
import { LegalModule } from './legal/legal.module';
import { Router } from '@angular/router';
import { FeatureToggleModule } from 'ngx-feature-toggle';
import { IFeatureToggle, LanguagesEnum, WeekDaysEnum } from '@gauzy/contracts';
import { HttpLoaderFactory } from './@shared/translate/translate.module';
import { FeatureService, GoogleMapsLoaderService } from './@core/services';
import { AppInitService } from './@core/services/app-init-service';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { CookieService } from 'ngx-cookie-service';
import { JobSearchUiModule } from '@job-search-ui-plugin';
import { NgxDaterangepickerMd } from 'ngx-daterangepicker-material';
import { dayOfWeekAsString } from './@theme/components/header/selectors/date-range-picker';
import { GAUZY_ENV } from './@core/constants';
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
		environment.production ? [] : AkitaNgDevtools,
		SharedModule.forRoot(),
		FeatureToggleModule,
		NgxPermissionsModule.forRoot(),
		NgxDaterangepickerMd.forRoot({
			firstDay: dayOfWeekAsString(WeekDaysEnum.MONDAY)
		}),
		JobSearchUiModule
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
