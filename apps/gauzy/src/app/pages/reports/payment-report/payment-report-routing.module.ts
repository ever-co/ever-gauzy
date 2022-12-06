import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DateRangePickerResolver } from '../../../@theme/components/header/selectors/date-range-picker';
import { PaymentReportComponent } from './payment-report/payment-report.component';

const routes: Routes = [
	{
		path: '',
		component: PaymentReportComponent,
		data: {
			datePicker: {
				unitOfTime: 'week'
			},
			selectors: {
				employee: false
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
export class PaymentReportRoutingModule {}
