import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	ContactSelectModule,
	CurrencyModule,
	i4netFiltersModule,
	LineChartModule,
	PaymentReportGridModule,
	SharedModule
} from '@gauzy/ui-core/shared';
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
		i4netFiltersModule,
		ContactSelectModule,
		CurrencyModule
	]
})
export class PaymentReportModule { }
