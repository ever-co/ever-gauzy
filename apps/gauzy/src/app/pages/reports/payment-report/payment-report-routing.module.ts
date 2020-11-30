import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PaymentReportComponent } from './payment-report/payment-report.component';

const routes: Routes = [
	{
		path: '',
		component: PaymentReportComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class PaymentReportRoutingModule {}
