import { Routes } from '@angular/router';

export const recapRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'tasks'
	},
	{
		path: 'daily',
		loadComponent: () => import('./features/recap/recap.component').then((m) => m.RecapComponent),
		loadChildren: () => import('./recap-children-routing.module').then((m) => m.recapChildRoutes)
	},
	{
		path: 'weekly',
		loadComponent: () =>
			import('./weekly/features/weekly-recap/weekly-recap.component').then((m) => m.WeeklyRecapComponent)
	},
	{
		path: 'monthly',
		loadComponent: () =>
			import('./monthly/features/monthly-recap/monthly-recap.component').then((m) => m.MonthlyRecapComponent)
	},
	{
		path: 'tasks',
		loadChildren: () =>
			import('../time-tracker/task-table/task-table.routing.module').then((m) => m.taskTableRoutes)
	},
	{
		path: '**',
		redirectTo: 'tasks'
	}
];
