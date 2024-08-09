import { NgModule } from '@angular/core';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import {
	ContactSelectModule,
	CurrencyModule,
	GauzyFiltersModule,
	LineChartModule,
	PaymentReportGridModule,
	SharedModule
} from '@gauzy/ui-core/shared';
import { PaymentReportRoutingModule } from './payment-report-routing.module';
import { PaymentReportComponent } from './payment-report/payment-report.component';

@NgModule({
	declarations: [PaymentReportComponent],
	imports: [
		PaymentReportRoutingModule,
		SharedModule,
		TranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		LineChartModule,
		PaymentReportGridModule,
		GauzyFiltersModule,
		ContactSelectModule,
		CurrencyModule
	]
})
export class PaymentReportModule {}
