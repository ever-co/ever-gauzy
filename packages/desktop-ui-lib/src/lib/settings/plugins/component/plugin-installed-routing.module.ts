import { Routes } from '@angular/router';
import { PluginComponent } from './plugin/plugin.component';
import { PluginListComponent } from './plugin-list/plugin-list.component';

export const pluginInstalledRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		component: PluginListComponent
	},
	{
		path: ':name',
		component: PluginComponent
	},
	{
		path: '**',
		redirectTo: ''
	}
];
