import { BrowserModule } from '@angular/platform-browser';
import { NgModule, APP_INITIALIZER, ErrorHandler } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import {
	NbDialogModule,
	NbThemeModule,
	NbToastrModule,
	NbDialogService,
	NbLayoutModule,
	NbDatepickerModule
} from '@nebular/theme';
import { NgxElectronModule } from 'ngx-electron';
import { AppService } from './app.service';
import {
	HttpClientModule,
	HTTP_INTERCEPTORS,
	HttpClient
} from '@angular/common/http';
import {
	NgxLoginModule,
	ImageViewerModule,
	UpdaterModule,
	SettingsModule,
	ScreenCaptureModule,
	TimeTrackerModule,
	SetupModule,
	SplashScreenModule,
	ElectronService
} from '@gauzy/desktop-ui-lib';
import { NbCardModule, NbButtonModule } from '@nebular/theme';
import { HttpLoaderFactory } from '../../../gauzy/src/app/@shared/translate/translate.module';
import { NgSelectModule } from '@ng-select/ng-select';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { AuthStrategy } from './auth//auth-strategy.service';
import { AuthService } from './auth/services/auth.service';
import { Store } from './auth/services/store.service';
import { NoAuthGuard } from './auth/no-auth.guard';
import { AppModuleGuard } from './app.module.guards';
import { APIInterceptor } from '../../../gauzy/src/app/@core/interceptors/api.interceptor';
import { TokenInterceptor } from './auth/token.interceptor';
import { ServerDownModule } from './server-down/server-down.module';
import { ServerConnectionService } from './auth/services/server-connection.service';
import { environment } from '../../../gauzy/src/environments/environment';
import { Router } from '@angular/router';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import * as Sentry from '@sentry/angular';

@NgModule({
	declarations: [AppComponent],
	imports: [
		NbLayoutModule,
		AuthModule,
		NbDialogModule.forRoot(),
		NbToastrModule.forRoot(),
		NbCardModule,
		NbButtonModule,
		BrowserModule,
		BrowserAnimationsModule,
		AppRoutingModule,
		NbThemeModule.forRoot({ name: 'gauzy-light' }),
		NgxLoginModule,
		SetupModule,
		TimeTrackerModule,
		NgxElectronModule,
		HttpClientModule,
		ScreenCaptureModule,
		SettingsModule,
		UpdaterModule,
		ImageViewerModule,
		NgSelectModule,
		SplashScreenModule,
		ServerDownModule,
		TranslateModule.forRoot({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbDatepickerModule.forRoot()
	],
	providers: [
		AppService,
		HttpClientModule,
		NbDialogService,
		AuthGuard,
		NoAuthGuard,
		AppModuleGuard,
		AuthStrategy,
		AuthService,
		ServerConnectionService,
		ElectronService,
		{
			provide: APP_INITIALIZER,
			useFactory: serverConnectionFactory,
			deps: [ServerConnectionService, Store, Router],
			multi: true
		},
		Store,
		{
			provide: HTTP_INTERCEPTORS,
			useClass: APIInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: TokenInterceptor,
			multi: true
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
		{
			provide: APP_INITIALIZER,
			useFactory: () => () => {},
			deps: [Sentry.TraceService],
			multi: true
		}
	],
	bootstrap: [AppComponent],
	exports: [NgSelectModule]
})
export class AppModule {}

export function serverConnectionFactory(
	provider: ServerConnectionService,
	store: Store,
	router: Router
) {
	return () => {
		return provider
			.checkServerConnection(environment.API_BASE_URL)
			.finally(() => {
				// if (store.serverConnection !== 200) {
				// 	router.navigate(['server-down']);
				// }
			})
			.catch(() => {});
		// return true;
	};
}
