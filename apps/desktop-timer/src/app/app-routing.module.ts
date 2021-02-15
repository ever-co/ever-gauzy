import { RouterModule, Routes, ExtraOptions } from '@angular/router';
import { NgModule } from '@angular/core';
import {
	ImageViewerComponent,
	SettingsComponent,
	ScreenCaptureComponent,
	TimeTrackerComponent,
	SetupComponent,
	UpdaterComponent
} from '../../../../libs/desktop-ui-lib/src/index';
import {
	NbAuthComponent,
	NbLoginComponent,
	NbLogoutComponent,
	NbRegisterComponent,
	NbRequestPasswordComponent,
	NbResetPasswordComponent
} from '@nebular/auth';

const routes: Routes = [
	{
		path: '',
		component: SetupComponent
	},
	{
		path: 'auth',
		component: NbAuthComponent,
		children: [
			{
				path: '',
				component: NbLoginComponent
			},
			{
				path: 'login',
				component: NbLoginComponent
			},
			{
				path: 'register',
				component: NbRegisterComponent
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
		component: TimeTrackerComponent
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
