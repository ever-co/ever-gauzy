import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { WeeklyTimeReportsComponent } from './weekly-time-reports/weekly-time-reports.component';
import { DateRangePickerResolver } from '../../../@shared/selectors/date-range-picker';

const routes: Routes = [
	{
		path: '',
		component: WeeklyTimeReportsComponent,
		data: {
			datePicker: {
				unitOfTime: 'week',
				isLockDatePicker: true
			}
		},
		resolve: { dates: DateRangePickerResolver }
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class WeeklyTimeReportsRoutingModule {}
