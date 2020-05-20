import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';

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
