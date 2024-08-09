import { Routes } from '@angular/router';

export const recapRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'daily'
	},
	{
		path: 'daily',
		loadComponent: () => import('./features/recap/recap.component').then((m) => m.RecapComponent)
	},
	{
		path: '**',
		redirectTo: 'daily'
	}
];
