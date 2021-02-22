import { RouterModule, Routes, ExtraOptions } from '@angular/router';
import { NgModule } from '@angular/core';
import {
	ImageViewerComponent,
	SettingsComponent,
	ScreenCaptureComponent,
	TimeTrackerComponent,
	SetupComponent,
	UpdaterComponent,
	SplashScreenComponent
} from '../../../../libs/desktop-ui-lib/src/index';
import {
	NbAuthComponent,
	NbLoginComponent,
	NbLogoutComponent,
	NbRegisterComponent,
	NbRequestPasswordComponent,
	NbResetPasswordComponent
} from '@nebular/auth';
import { AuthGuard } from './auth/auth.guard';
import { NoAuthGuard } from './auth/no-auth.guard';
import { ServerDownPage } from './server-down/server-down.page';
import { AppModuleGuard } from './app.module.guards';

const routes: Routes = [
	{
		path: 'setup',
		component: SetupComponent
	},
	{
		path: 'auth',
		component: NbAuthComponent,
		children: [
			{
				path: '',
				component: NbLoginComponent,
				canActivate: [AppModuleGuard, NoAuthGuard]
			},
			{
				path: 'login',
				component: NbLoginComponent,
				canActivate: [AppModuleGuard, NoAuthGuard]
			},
			{
				path: 'register',
				component: NbRegisterComponent,
				canActivate: [NoAuthGuard]
			},
			{
				path: 'logout',
				component: NbLogoutComponent
			},
			{
				path: 'request-password',
				component: NbRequestPasswordComponent
			},
			{
				path: 'reset-password',
				component: NbResetPasswordComponent
			}
		]
	},
	{
		path: 'time-tracker',
		component: TimeTrackerComponent,
		canActivate: [AppModuleGuard, AuthGuard]
	},
	{
		path: 'screen-capture',
		component: ScreenCaptureComponent
	},
	{
		path: 'settings',
		component: SettingsComponent
	},
	{
		path: 'updater',
		component: UpdaterComponent
	},
	{
		path: 'viewer',
		component: ImageViewerComponent
	},
	{
		path: 'splash',
		component: SplashScreenComponent
	},
	{
		path: 'server-down',
		component: ServerDownPage
	},
	{
		path: '',
		component: TimeTrackerComponent,
		canActivate: [AppModuleGuard, AuthGuard]
	}
];

const config: ExtraOptions = {
	useHash: true
};

@NgModule({
	imports: [RouterModule.forRoot(routes, config)],
	exports: [RouterModule]
})
export class AppRoutingModule {}
