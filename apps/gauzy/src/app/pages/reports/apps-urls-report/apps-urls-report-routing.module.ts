import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AppsUrlsReportComponent } from './apps-urls-report/apps-urls-report.component';
import { DateRangePickerResolver } from '../../../@shared/selectors/date-range-picker';

const routes: Routes = [
	{
		path: '',
		component: AppsUrlsReportComponent,
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
export class AppsUrlsReportRoutingModule {}
