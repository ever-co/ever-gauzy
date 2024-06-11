import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TimeReportsComponent } from './time-reports/time-reports.component';
import { DateRangePickerResolver } from '../../../@shared/selectors/date-range-picker';

const routes: Routes = [
	{
		path: '',
		component: TimeReportsComponent,
		data: {
			datePicker: {
				unitOfTime: 'week'
			}
		},
		resolve: { dates: DateRangePickerResolver }
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class TimeReportsRoutingModule {}
