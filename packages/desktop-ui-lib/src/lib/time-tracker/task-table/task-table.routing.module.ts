import { Routes } from '@angular/router';

export const taskTableRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'table'
	},
	{
		path: 'table',
		loadComponent: () => import('./table/task-table.component').then((m) => m.TaskTableComponent)
	},
	{
		path: '**',
		redirectTo: 'table'
	}
];
