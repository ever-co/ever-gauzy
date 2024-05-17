import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DateRangePickerResolver } from './../../../../@theme/components/header/selectors/date-range-picker';
import { TimeAndActivitiesComponent } from './time-and-activities/time-and-activities.component';

const routes: Routes = [
	{
		path: '',
		component: TimeAndActivitiesComponent,
		data: {
			title: 'ACTIVITY.TIME_AND_ACTIVITIES',
			datePicker: {
				unitOfTime: 'day',
				isLockDatePicker: true,
				isSaveDatePicker: true,
				isSingleDatePicker: true
			}
		},
		resolve: {
			dates: DateRangePickerResolver
		},
		runGuardsAndResolvers: 'paramsOrQueryParamsChange'
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class TimeAndActivitiesRoutingModule {}
