import { Routes } from '@angular/router';
import { RecapComponent } from './features/recap/recap.component';
import { recapChildRoutes } from './recap-children-routing.module';

export const recapRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'tasks'
	},
	{
		path: 'daily',
		component: RecapComponent,
		children: recapChildRoutes
	},
	{
		path: 'weekly',
		loadChildren: () =>
			import('./recap.module').then((m) => m.RecapModule)
	},
	{
		path: 'monthly',
		loadChildren: () =>
			import('./recap.module').then((m) => m.RecapModule)
	},
	{
		path: 'tasks',
		loadChildren: () =>
			import('../time-tracker/task-table/task-table.module').then((m) => m.TaskTableModule)
	},
	{
		path: '**',
		redirectTo: 'tasks'
	}
];
