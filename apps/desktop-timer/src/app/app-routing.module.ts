import { NgModule } from '@angular/core';
import { ExtraOptions, RouterModule, Routes } from '@angular/router';
import {
	AboutComponent,
	AlwaysOnComponent,
	AUTH_CONNECTION_GUARD_CONFIG,
	AuthConnectionGuard,
	AuthGuard,
	DEFAULT_AUTH_CONNECTION_GUARD_CONFIG,
	ImageViewerComponent,
	ScreenCaptureComponent,
	ServerDownPage,
	SettingsComponent,
	SetupComponent,
	SplashScreenComponent,
	TimeTrackerComponent,
	UpdaterComponent
} from '@gauzy/desktop-ui-lib';
import { AppModuleGuard } from './app.module.guards';

const routes: Routes = [
	{
		path: 'setup',
		component: SetupComponent
	},
	{
		path: 'auth',
		loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.authRoutes),
		canActivate: [AppModuleGuard, AuthConnectionGuard]
	},
	{
		path: 'time-tracker',
		component: TimeTrackerComponent,
		canActivate: [AppModuleGuard, AuthGuard, AuthConnectionGuard],
		loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.recapRoutes)
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
		canActivate: [AppModuleGuard, AuthGuard, AuthConnectionGuard]
	},
	{
		path: 'about',
		component: AboutComponent
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
	exports: [RouterModule],
	providers: [
		{
			provide: AUTH_CONNECTION_GUARD_CONFIG,
			useValue: DEFAULT_AUTH_CONNECTION_GUARD_CONFIG
		}
	]
})
export class AppRoutingModule {}
