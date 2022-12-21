import { RouterModule, Routes, ExtraOptions } from '@angular/router';
import { NgModule } from '@angular/core';
import {
	SettingsComponent,
	SetupComponent,
	UpdaterComponent,
	ServerDashboardComponent,
	AboutComponent
} from '@gauzy/desktop-ui-lib';

const routes: Routes = [
	{
		path: '',
		component: SetupComponent
	},
	{
		path: 'setup',
		component: SetupComponent
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
		path: 'server-dashboard',
		component: ServerDashboardComponent
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
