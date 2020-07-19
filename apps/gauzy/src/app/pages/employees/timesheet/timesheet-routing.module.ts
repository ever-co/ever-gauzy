import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/models';

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
				loadChildren: () =>
					import('./daily/daily.module').then((m) => m.DailyModule)
			},
			{
				path: 'weekly',
				loadChildren: () =>
					import('./weekly/weekly.module').then((m) => m.WeeklyModule)
			},
			{
				path: 'calendar',
				loadChildren: () =>
					import('./calendar/calendar.module').then(
						(m) => m.CalendarModule
					)
			},
			{
				path: 'approvals',
				canActivate: [NgxPermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.CAN_APPROVE_TIMESHEET],
						redirectTo: '/pages/employees/timesheets/daily'
					}
				},
				loadChildren: () =>
					import('./approvals/approvals.module').then(
						(m) => m.ApprovalsModule
					)
			}
		]
	},
	{
		path: ':id',
		loadChildren: () =>
			import('./view/view.module').then((m) => m.ViewModule)
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class TimesheetRoutingModule {}
