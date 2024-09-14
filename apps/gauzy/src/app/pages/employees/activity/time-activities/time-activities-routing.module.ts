import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DateRangePickerResolver } from '@gauzy/ui-core/shared';
import { TimeActivitiesComponent } from './time-activities/time-activities.component';

const routes: Routes = [
	{
		path: '',
		component: TimeActivitiesComponent,
		data: {
			title: 'ACTIVITY.TIME_AND_ACTIVITIES',
			datePicker: {
				unitOfTime: 'day',
				isLockDatePicker: true,
				isSaveDatePicker: true,
				isSingleDatePicker: true
			}
		},
		resolve: { dates: DateRangePickerResolver }
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class TimeActivitiesRoutingModule {}
