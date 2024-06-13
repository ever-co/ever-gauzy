import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	ContactSelectModule,
	CurrencyModule,
	GauzyFiltersModule,
	LineChartModule,
	PaymentReportGridModule,
	SharedModule
} from '@gauzy/ui-sdk/shared';
import { PaymentReportRoutingModule } from './payment-report-routing.module';
import { PaymentReportComponent } from './payment-report/payment-report.component';

@NgModule({
	declarations: [PaymentReportComponent],
	imports: [
		CommonModule,
		PaymentReportRoutingModule,
		SharedModule,
		I18nTranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		FormsModule,
		LineChartModule,
		PaymentReportGridModule,
		GauzyFiltersModule,
		ContactSelectModule,
		CurrencyModule
	]
})
export class PaymentReportModule {}
