import { Routes } from '@angular/router';

export const recapChildRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'hourly'
	},
	{
		path: 'hourly',
		loadComponent: () =>
			import('./features/time-tracking-charts/time-tracking-charts.component').then(
				(m) => m.TimeTrackingChartsComponent
			)
	},
	{
		path: 'activities',
		loadComponent: () =>
			import('./shared/features/activity-report/activity-report.component').then((m) => m.ActivityReportComponent)
	},
	{
		path: 'tasks',
		loadComponent: () => import('./features/tasks/tasks.component').then((m) => m.TasksComponent)
	},
	{
		path: 'projects',
		loadComponent: () => import('./features/projects/projects.component').then((m) => m.ProjectsComponent)
	},
	{
		path: '**',
		redirectTo: 'hourly'
	}
];
