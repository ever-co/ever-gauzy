import { Routes } from '@angular/router';

export const taskTableRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'table'
	},
	{
		path: 'table',
		loadChildren: () => import('./task-table.module').then((m) => m.TaskTableModule)
	},
	{
		path: '**',
		redirectTo: 'table'
	}
];
