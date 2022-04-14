import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';

const routes: Routes = [
	{
		path: '',
		redirectTo: 'time-activities',
		pathMatch: 'full'
	},
	{
		path: '',
		component: LayoutComponent,
		children: [
			{
				path: 'time-activities',
				data: {
					title: 'ACTIVITY.TIME_AND_ACTIVITIES',
					datePicker: {
						unitOfTime: 'day'
					}
				},
				loadChildren: () =>
					import(
						'./time-and-activities/time-and-activities.module'
					).then((m) => m.TimeAndActivitiesModule)
			},
			{
				path: 'screenshots',
				data: {
					title: 'ACTIVITY.SCREENSHOTS',
					datePicker: {
						unitOfTime: 'day'
					}
				},
				loadChildren: () =>
					import('./screenshot/screenshot.module').then(
						(m) => m.ScreenshotModule
					)
			},
			{
				path: 'apps',
				data: {
					title: 'ACTIVITY.APPS',
					type: 'apps',
					datePicker: {
						unitOfTime: 'day'
					}
				},
				loadChildren: () =>
					import('./app-url-activity/app-url-activity.module').then(
						(m) => m.AppUrlActivityModule
					)
			},
			{
				path: 'urls',
				data: {
					title: 'ACTIVITY.VISITED_SITES',
					type: 'urls',
					datePicker: {
						unitOfTime: 'day'
					}
				},
				loadChildren: () =>
					import('./app-url-activity/app-url-activity.module').then(
						(m) => m.AppUrlActivityModule
					)
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ActivityRoutingModule {}
