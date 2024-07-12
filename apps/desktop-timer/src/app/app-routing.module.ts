import { NgModule } from '@angular/core';
import { ExtraOptions, RouterModule, Routes } from '@angular/router';
import {
	AboutComponent,
	AlwaysOnComponent,
	AuthGuard,
	ImageViewerComponent,
	NgxLoginComponent,
	NoAuthGuard,
	ScreenCaptureComponent,
	ServerDownPage,
	SettingsComponent,
	SetupComponent,
	SplashScreenComponent,
	TimeTrackerComponent,
	UpdaterComponent
} from '@gauzy/desktop-ui-lib';
import { NbAuthComponent, NbRequestPasswordComponent, NbResetPasswordComponent } from '@nebular/auth';
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
				redirectTo: 'login',
				pathMatch: 'full'
			},
			{
				path: 'login',
				component: NgxLoginComponent,
				canActivate: [AppModuleGuard, NoAuthGuard]
			},
			{
				path: 'request-password',
				component: NbRequestPasswordComponent,
				canActivate: [AppModuleGuard, NoAuthGuard]
			},
			{
				path: 'reset-password',
				component: NbResetPasswordComponent,
				canActivate: [AppModuleGuard, NoAuthGuard]
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
		path: 'always-on',
		component: AlwaysOnComponent
	},
	{
		path: 'settings',
		component: SettingsComponent,
		loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.pluginRoutes)
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
		path: 'splash-screen',
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
	},
	{
		path: 'about',
		component: AboutComponent
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
