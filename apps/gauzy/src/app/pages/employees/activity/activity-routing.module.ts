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
				path: 'screenshots',
				data: {
					title: 'ACTIVITY.SCREENSHOTS'
				},
				loadChildren: () =>
					import('./screenshot/screenshot.module').then(
						(m) => m.ScreenshotModule
					)
			},
			{
				path: 'time-activities',
				data: {
					title: 'ACTIVITY.TIME_AND_ACTIVITIES'
				},
				loadChildren: () =>
					import(
						'./time-and-activities/time-and-activities.module'
					).then((m) => m.TimeAndActivitiesModule)
			},
			{
				path: 'urls',
				data: {
					title: 'ACTIVITY.VISITED_SITES',
					type: 'urls'
				},
				loadChildren: () =>
					import('./app-url-activity/app-url-activity.module').then(
						(m) => m.AppUrlActivityModule
					)
			},
			{
				path: 'apps',
				data: {
					title: 'ACTIVITY.APPS',
					type: 'apps'
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
