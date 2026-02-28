import { Routes } from '@angular/router';

export const PluginRoutingModule: Routes = [
	{
		path: '',
		loadComponent: () =>
			import('./component/plugin-layout/plugin-layout.component').then((m) => m.PluginLayoutComponent),
		loadChildren: () => import('./plugin.route').then((m) => m.routes)
	}
];
