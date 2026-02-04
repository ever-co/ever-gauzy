import { Routes } from '@angular/router';
import { TimeTrackingChartsComponent } from './features/time-tracking-charts/time-tracking-charts.component';
import { ActivityReportComponent } from './shared/features/activity-report/activity-report.component';
import { TasksComponent } from './features/tasks/tasks.component';
import { ProjectsComponent } from './features/projects/projects.component';

export const recapChildRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'hourly'
	},
	{
		path: 'hourly',
		component: TimeTrackingChartsComponent
	},
	{
		path: 'activities',
		component: ActivityReportComponent
	},
	{
		path: 'tasks',
		component: TasksComponent
	},
	{
		path: 'projects',
		component: ProjectsComponent
	},
	{
		path: '**',
		redirectTo: 'hourly'
	}
];
