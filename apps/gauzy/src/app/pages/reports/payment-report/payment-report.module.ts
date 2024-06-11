import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentReportRoutingModule } from './payment-report-routing.module';
import { PaymentReportComponent } from './payment-report/payment-report.component';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ContactSelectModule, CurrencyModule, GauzyFiltersModule } from '@gauzy/ui-sdk/shared';
import { SharedModule } from '@gauzy/ui-sdk/shared';
import { PaymentReportGridModule } from '../../../@shared/report/payment-report-grid/payment-report-grid.module';
import { LineChartModule } from '../../../@shared/report/charts/line-chart/line-chart.module';

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
