import { NgModule } from '@angular/core';
import { ExtraOptions, RouterModule, Routes } from '@angular/router';
import {
	AboutComponent,
	AuthGuard,
	ServerDownPage,
	SettingsComponent,
	SetupComponent,
	SplashScreenComponent,
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
		canActivate: [AppModuleGuard]
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
		path: 'splash-screen',
		component: SplashScreenComponent
	},
	{
		path: 'server-down',
		component: ServerDownPage
	},
	{
		path: '',
		component: SetupComponent
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
	exports: [RouterModule]
})
export class AppRoutingModule {}
