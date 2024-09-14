import { Routes } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryService, PermissionsGuard } from '@gauzy/ui-core/core';
import { TimesheetResolver } from '../timesheet.resolver';
import { TimesheetViewComponent } from './view/view.component';

/**
 * Create and configures routes for the timesheet details module.
 *
 * @param _pageRouteRegistryService
 * @returns
 */
export const createTimesheetDetailsRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Routes => [
	{
		path: '',
		component: TimesheetViewComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.CAN_APPROVE_TIMESHEET],
				redirectTo: '/pages/employees/timesheets/daily'
			},
			selectors: false
		},
		resolve: { timesheet: TimesheetResolver }
	}
];
