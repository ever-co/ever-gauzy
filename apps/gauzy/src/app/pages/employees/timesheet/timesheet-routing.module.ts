import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';

const routes: Routes = [
	{
		path: '',
		redirectTo: 'daily',
		pathMatch: 'full'
	},
	{
		path: '',
		component: LayoutComponent,
		children: [
			{
				path: 'daily',
				loadChildren: () => import('./daily/daily.module').then(
					(m) => m.DailyModule
				),
				data: {
					datePicker: {
						unitOfTime: 'day'
					}
				}
			},
			{
				path: 'weekly',
				loadChildren: () => import('./weekly/weekly.module').then(
					(m) => m.WeeklyModule
				),
				data: {
					datePicker: {
						unitOfTime: 'week',
						isLockDatePicker: true
					}
				}
			},
			{
				path: 'calendar',
				loadChildren: () => import('./calendar/calendar.module').then(
					(m) => m.CalendarModule
				),
				data: {
					selectors: {
						date: false
					},
					datePicker: {
						unitOfTime: 'week',
						isLockDatePicker: true,
						isSaveDatePicker: true
					}
				}
			},
			{
				path: 'approvals',
				canActivate: [NgxPermissionsGuard],
				loadChildren: () => import('./approvals/approvals.module').then(
					(m) => m.ApprovalsModule
				),
				data: {
					permissions: {
						only: [PermissionsEnum.CAN_APPROVE_TIMESHEET],
						redirectTo: '/pages/employees/timesheets/daily'
					},
					selectors: {
						project: false
					},
					datePicker: {
						unitOfTime: 'month'
					}
				}
			}
		]
	},
	{
		path: ':id',
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.CAN_APPROVE_TIMESHEET],
				redirectTo: '/pages/employees/timesheets/daily'
			},
			selectors: {
				project: false,
				employee: false,
				date: false,
				organization: false
			}
		},
		loadChildren: () => import('./view/view.module').then((m) => m.ViewModule)
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class TimesheetRoutingModule {}
