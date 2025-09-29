import { Routes } from '@angular/router';

export const agentDashboardRoutes: Routes = [
	{
		path: 'logs',
		loadComponent: () => import('./logs/logs.component').then((m) => m.LogsPageComponent),
	},
	{
		path: 'sync-activity',
		loadComponent: () => import('./activity-sync/activity-sync.component').then((m) => m.SyncPageComponent),
	},
	{
		path: '',
		redirectTo: 'logs',
		pathMatch: 'full',
	}
];
