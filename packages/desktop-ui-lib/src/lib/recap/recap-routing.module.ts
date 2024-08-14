import { Routes } from '@angular/router';

export const recapRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'daily'
	},
	{
		path: 'daily',
		loadChildren: () => import('./recap-children-routing.module').then((m) => m.recapChildRoutes)
	},
	{
		path: '**',
		redirectTo: 'daily'
	}
];
