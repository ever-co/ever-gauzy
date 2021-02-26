import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import {
	NbDialogModule,
	NbThemeModule,
	NbToastrModule,
	NbDialogService,
	NbLayoutModule
} from '@nebular/theme';
import { NbAuthModule } from '@nebular/auth';
import { NgxElectronModule } from 'ngx-electron';
import { AppService } from './app.service';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import {
	AlertComponent,
	ImageViewerModule,
	UpdaterModule,
	SettingsModule,
	ScreenCaptureModule,
	TimeTrackerModule,
	SetupModule,
	SplashScreenModule
} from '../../../../libs/desktop-ui-lib/src';
import { NbCardModule, NbButtonModule } from '@nebular/theme';
import { NgxAuthModule } from '../../../gauzy/src/app/auth/auth.module';
import { NgSelectModule } from '@ng-select/ng-select';
import { AuthModule } from './auth/auth.module';
import { environment } from '../../../gauzy/src/environments/environment';
import { AuthGuard } from './auth/auth.guard';
import { AuthStrategy } from './auth//auth-strategy.service';
import { AuthService } from './auth/services/auth.service';
import { Store } from './auth/services/store.service';
import { NoAuthGuard } from './auth/no-auth.guard';
import { AppModuleGuard } from './app.module.guards';
import { NgxPermissionsService, NgxRolesService } from 'ngx-permissions';
import { APIInterceptor } from '../../../gauzy/src/app/@core/api.interceptor';
import { TokenInterceptor } from './auth/token.interceptor';
import { ServerDownModule } from './server-down/server-down.module';
import { ServerConnectionService } from './auth/services/server-connection.service';

const socialLinks = [
	{
		url: environment.GOOGLE_AUTH_LINK,
		icon: 'google-outline'
	},
	{
		url: environment.LINKEDIN_AUTH_LINK,
		icon: 'linkedin-outline'
	},
	{
		url: environment.GITHUB_AUTH_LINK,
		target: '_blank',
		icon: 'github-outline'
	},
	{
		url: environment.TWITTER_AUTH_LINK,
		target: '_blank',
		icon: 'twitter-outline'
	},
	{
		url: environment.FACEBOOK_AUTH_LINK,
		target: '_blank',
		icon: 'facebook-outline'
	},
	{
		url: environment.MICROSOFT_AUTH_LINK,
		target: '_blank',
		icon: 'grid'
	}
];

@NgModule({
	declarations: [AppComponent, AlertComponent],
	imports: [
		NgxAuthModule,
		NbLayoutModule,
		NbAuthModule.forRoot({
			strategies: [AuthStrategy.setup({ name: 'email' })],
			forms: {
				login: { socialLinks },
				register: { socialLinks }
			}
		}),
		NbDialogModule.forRoot(),
		NbToastrModule.forRoot(),
		NbCardModule,
		NbButtonModule,
		BrowserModule,
		BrowserAnimationsModule,
		AppRoutingModule,
		NbThemeModule.forRoot({ name: 'default' }),
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
		ServerDownModule
	],
	providers: [
		AppService,
		HttpClientModule,
		NbDialogService,
		...NbAuthModule.forRoot({
			strategies: [AuthStrategy.setup({ name: 'email' })],
			forms: {
				login: { socialLinks },
				register: { socialLinks }
			}
		}).providers,
		AuthGuard,
		NoAuthGuard,
		AppModuleGuard,
		AuthStrategy,
		AuthService,
		ServerConnectionService,
		Store,
		NgxPermissionsService,
		NgxRolesService,
		{
			provide: HTTP_INTERCEPTORS,
			useClass: APIInterceptor,
			multi: true
		},
		{
			provide: HTTP_INTERCEPTORS,
			useClass: TokenInterceptor,
			multi: true
		}
	],
	bootstrap: [AppComponent],
	exports: [NgSelectModule]
})
export class AppModule {}
