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
				loadChildren: () => import('./time-and-activities/time-and-activities.module').then(
					(m) => m.TimeAndActivitiesModule
				),
				data: {
					title: 'ACTIVITY.TIME_AND_ACTIVITIES',
					datePicker: {
						unitOfTime: 'day',
						isLockDatePicker: true,
						isSaveDatePicker: true,
						isSingleDatePicker: true
					}
				}
			},
			{
				path: 'screenshots',
				loadChildren: () => import('./screenshot/screenshot.module').then(
					(m) => m.ScreenshotModule
				),
				data: {
					title: 'ACTIVITY.SCREENSHOTS',
					datePicker: {
						unitOfTime: 'day',
						isLockDatePicker: true,
						isSaveDatePicker: true,
						isSingleDatePicker: true,
						isDisableFutureDate: true
					}
				}
			},
			{
				path: 'apps',
				loadChildren: () => import('./app-url-activity/app-url-activity.module').then(
					(m) => m.AppUrlActivityModule
				),
				data: {
					title: 'ACTIVITY.APPS',
					type: 'apps',
					datePicker: {
						unitOfTime: 'day',
						isLockDatePicker: true,
						isSaveDatePicker: true,
						isSingleDatePicker: true,
						isDisableFutureDate: true
					}
				}
			},
			{
				path: 'urls',
				loadChildren: () => import('./app-url-activity/app-url-activity.module').then(
					(m) => m.AppUrlActivityModule
				),
				data: {
					title: 'ACTIVITY.VISITED_SITES',
					type: 'urls',
					datePicker: {
						unitOfTime: 'day',
						isLockDatePicker: true,
						isSaveDatePicker: true,
						isSingleDatePicker: true,
						isDisableFutureDate: true
					}
				}
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ActivityRoutingModule {}
