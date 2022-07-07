import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import { DateRangePickerResolver } from '../../../@theme/components/header/selectors/date-range-picker';

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
						unitOfTime: 'day',
						isLockDatePicker: true,
						isSaveDatePicker: true,
						isSingleDatePicker: true
					}
				},
				resolve: {
					dates: DateRangePickerResolver
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
						isLockDatePicker: true,
						isSaveDatePicker: true
					}
				},
				resolve: {
					dates: DateRangePickerResolver
				}
			},
			{
				path: 'calendar',
				loadChildren: () => import('./calendar/calendar.module').then(
					(m) => m.CalendarModule
				),
				data: {
					datePicker: {
						unitOfTime: 'week'
					}
				},
				resolve: {
					dates: DateRangePickerResolver
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
						unitOfTime: 'month',
						isLockDatePicker: true,
						isSaveDatePicker: true
					}
				},
				resolve: {
					dates: DateRangePickerResolver
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
