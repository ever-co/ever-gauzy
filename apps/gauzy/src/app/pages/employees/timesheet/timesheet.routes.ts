import { Route } from '@angular/router';
import { TimesheetLayoutComponent } from './layout/layout.component';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';

/**
 * Create and configures routes for the timesheet module.
 *
 * @param _pageRouteRegistryService
 * @returns
 */
export const createTimesheetRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Route[] => [
	{
		path: '',
		component: TimesheetLayoutComponent,
		data: { tabsetId: 'timesheet' },
		children: [
			{
				path: '',
				redirectTo: 'daily',
				pathMatch: 'full'
			},
			{
				path: 'daily',
				loadChildren: () => import('./daily/daily.module').then((m) => m.DailyModule)
			},
			{
				path: 'weekly',
				loadChildren: () => import('./weekly/weekly.module').then((m) => m.WeeklyModule)
			},
			{
				path: 'calendar',
				loadChildren: () => import('./calendar/calendar.module').then((m) => m.CalendarModule)
			},
			{
				path: 'approvals',
				loadChildren: () => import('./approvals/approvals.module').then((m) => m.ApprovalsModule)
			},
			..._pageRouteRegistryService.getPageLocationRoutes('timesheet')
		]
	},
	{
		path: ':id',
		loadChildren: () => import('./view/view.module').then((m) => m.ViewModule)
	}
];
