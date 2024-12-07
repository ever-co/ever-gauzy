import { NgModule } from '@angular/core';
import { ExtraOptions, RouterModule, Routes } from '@angular/router';
import {
	AboutComponent,
	AlwaysOnComponent,
	ImageViewerComponent,
	ScreenCaptureComponent,
	SettingsComponent,
	SetupComponent,
	SplashScreenComponent,
	TimeTrackerComponent,
	UpdaterComponent
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
		component: TimeTrackerComponent,
		loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.recapRoutes)
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

/**
 * Configures the router for the application.
 */
const config: ExtraOptions = {
	useHash: true
};

@NgModule({
	imports: [RouterModule.forRoot(routes, config)],
	exports: [RouterModule]
})
export class AppRoutingModule {}
