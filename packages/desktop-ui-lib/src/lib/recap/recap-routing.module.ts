import { Routes } from '@angular/router';
import { RecapComponent } from './features/recap/recap.component';
import { recapChildRoutes } from './recap-children-routing.module';
import { WeeklyRecapComponent } from './weekly/features/weekly-recap/weekly-recap.component';
import { MonthlyRecapComponent } from './monthly/features/monthly-recap/monthly-recap.component';

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
		component: WeeklyRecapComponent
	},
	{
		path: 'monthly',
		component: MonthlyRecapComponent
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
