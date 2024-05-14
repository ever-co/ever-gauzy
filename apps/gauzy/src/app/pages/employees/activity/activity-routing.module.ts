import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DateRangePickerResolver } from '../../../@theme/components/header/selectors/date-range-picker';
import { ActivityLayoutComponent } from './layout/layout.component';

const routes: Routes = [
	{
		path: '',
		redirectTo: 'time-activities',
		pathMatch: 'full'
	},
	{
		path: '',
		component: ActivityLayoutComponent,
		children: [
			{
				path: 'time-activities',
				loadChildren: () =>
					import('./time-and-activities/time-and-activities.module').then((m) => m.TimeAndActivitiesModule)
			},
			{
				path: 'screenshots',
				loadChildren: () => import('./screenshot/screenshot.module').then((m) => m.ScreenshotModule)
			},
			{
				path: 'apps',
				loadChildren: () =>
					import('./app-url-activity/app-url-activity.module').then((m) => m.AppUrlActivityModule),
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
				},
				resolve: {
					dates: DateRangePickerResolver
				},
				runGuardsAndResolvers: 'paramsOrQueryParamsChange'
			},
			{
				path: 'urls',
				loadChildren: () =>
					import('./app-url-activity/app-url-activity.module').then((m) => m.AppUrlActivityModule),
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
				},
				resolve: {
					dates: DateRangePickerResolver
				},
				runGuardsAndResolvers: 'paramsOrQueryParamsChange'
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ActivityRoutingModule {}
