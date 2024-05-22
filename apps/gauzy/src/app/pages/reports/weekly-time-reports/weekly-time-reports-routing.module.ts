import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DateRangePickerResolver } from '../../../@theme/components/header/selectors/date-range-picker';
import { WeeklyTimeReportsComponent } from './weekly-time-reports/weekly-time-reports.component';

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
		resolve: {
			dates: DateRangePickerResolver
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class WeeklyTimeReportsRoutingModule {}
