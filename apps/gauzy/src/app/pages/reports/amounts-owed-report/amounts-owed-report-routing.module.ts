import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AmountsOwedReportComponent } from './amounts-owed-report/amounts-owed-report.component';
import { DateRangePickerResolver } from '../../../@shared/selectors/date-range-picker';

const routes: Routes = [
	{
		path: '',
		component: AmountsOwedReportComponent,
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
export class AmountsOwedReportRoutingModule {}
