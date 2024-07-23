import { RouterModule, Routes, ExtraOptions } from '@angular/router';
import { NgModule } from '@angular/core';
import {
	ImageViewerComponent,
	SettingsComponent,
	ScreenCaptureComponent,
	TimeTrackerComponent,
	SetupComponent,
	UpdaterComponent,
	AboutComponent,
	SplashScreenComponent,
	AlwaysOnComponent
} from '@gauzy/desktop-ui-lib';

const routes: Routes = [
	{
		path: '',
		component: TimeTrackerComponent
	},
	{
		path: 'setup',
		component: SetupComponent
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
		path: 'about',
		component: AboutComponent
	},
	{
		path: 'splash-screen',
		component: SplashScreenComponent
	},
	{
		path: 'always-on',
		component: AlwaysOnComponent
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
