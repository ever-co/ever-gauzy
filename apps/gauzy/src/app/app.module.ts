/**
 * @license
 * Copyright Akveo. All Rights Reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */
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
import { TokenInterceptor } from './@core/auth/token.interceptor';

import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { Cloudinary as CloudinaryCore } from 'cloudinary-core';
import { CloudinaryModule } from '@cloudinary/angular-5.x';
import {
	cloudinaryConfiguration,
	environment
} from '../environments/environment';
import { FileUploadModule } from 'ng2-file-upload';
import { APIInterceptor } from './@core/api.interceptor';
import { ServerConnectionService } from './@core/services/server-connection.service';
import { Store } from './@core/services/store.service';
import { AppModuleGuard } from './app.module.guards';
import { DangerZoneMutationModule } from './@shared/settings/danger-zone-mutation.module';
import * as Sentry from '@sentry/browser';
import { SentryErrorHandler } from './@core/sentry-error.handler';
import { TimeTrackerModule } from './@shared/time-tracker/time-tracker.module';
import { SharedModule } from './@shared/shared.module';
import { HubstaffTokenInterceptor } from './@core/hubstaff-token-interceptor';
import { AkitaNgDevtools } from '@datorama/akita-ngdevtools';
import { LanguageInterceptor } from './@core/language.interceptor';
import { NgxElectronModule } from 'ngx-electron';
import { NgxPermissionsModule } from 'ngx-permissions';
import { ColorPickerService } from 'ngx-color-picker';
import { EstimateEmailModule } from './auth/estimate-email/estimate-email.module';

export const cloudinary = {
	Cloudinary: CloudinaryCore
};

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http);
}
if (environment.SENTRY_DNS && environment.production) {
	Sentry.init({
		dsn: environment.SENTRY_DNS,
		environment: environment.production ? 'production' : 'development'
	});
}
@NgModule({
	declarations: [AppComponent],
	imports: [
		EstimateEmailModule,
		BrowserModule,
		BrowserAnimationsModule,
		HttpClientModule,
		DangerZoneMutationModule,
		AppRoutingModule,
		NbCalendarModule,
		NbCalendarKitModule,
		ThemeModule.forRoot(),
		NbSidebarModule.forRoot(),
		NbMenuModule.forRoot(),
		NbDatepickerModule.forRoot(),
		NbDialogModule.forRoot(),
		NbWindowModule.forRoot(),
		NbToastrModule.forRoot(),
		NbChatModule.forRoot({
			messageGoogleMapKey: 'AIzaSyA_wNuCzia92MAmdLRzmqitRGvCF7wCZPY'
		}),
		CoreModule.forRoot(),
		TranslateModule.forRoot({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		CloudinaryModule.forRoot(cloudinary, cloudinaryConfiguration),
		FileUploadModule,
		TimeTrackerModule.forRoot(),
		environment.production ? [] : AkitaNgDevtools,
		SharedModule.forRoot(),
		NgxElectronModule,
		NgxPermissionsModule.forRoot()
	],
	bootstrap: [AppComponent],
	providers: [
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
		ServerConnectionService,
		{
			provide: APP_INITIALIZER,
			useFactory: serverConnectionFactory,
			deps: [ServerConnectionService, Store],
			multi: true
		},
		{
			provide: ErrorHandler,
			useClass: SentryErrorHandler
		},
		AppModuleGuard,
		ColorPickerService
	]
})
export class AppModule {}

export function serverConnectionFactory(
	provider: ServerConnectionService,
	store: Store
) {
	return () => provider.load(environment.API_BASE_URL, store);
}
