import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TimeLimitReportComponent } from './time-limit-report/time-limit-report.component';
import { DateRangePickerResolver } from '../../../@theme/components/header/selectors/date-range-picker';

const routes: Routes = [
	{
		path: '',
		component: TimeLimitReportComponent,
		data: {
			duration: 'day',
			title: 'REPORT_PAGE.DAILY_LIMIT_REPORT',
			datePicker: {
				unitOfTime: 'week'
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
export class TimeLimitReportRoutingModule {}
