import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DateRangePickerResolver } from '../../../@theme/components/header/selectors/date-range-picker';
import { TimeReportsComponent } from './time-reports/time-reports.component';

const routes: Routes = [
	{
		path: '',
		component: TimeReportsComponent,
		data: {
			datePicker: {
				unitOfTime: 'week'
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
export class TimeReportsRoutingModule {}
