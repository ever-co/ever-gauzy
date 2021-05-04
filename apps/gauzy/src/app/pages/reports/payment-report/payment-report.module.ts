import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PaymentReportRoutingModule } from './payment-report-routing.module';
import { PaymentReportComponent } from './payment-report/payment-report.component';
import { FormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbSelectModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { FiltersModule } from '../../../@shared/timesheet/filters/filters.module';
import { SharedModule } from '../../../@shared/shared.module';
import { PaymentReportGridModule } from '../../../@shared/report/payment-report-grid/payment-report-grid.module';
import { LineChartModule } from '../../../@shared/report/charts/line-chart/line-chart.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';

@NgModule({
	declarations: [PaymentReportComponent],
	imports: [
		CommonModule,
		PaymentReportRoutingModule,
		SharedModule,
		TranslateModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		FiltersModule,
		NbSelectModule,
		FormsModule,
		LineChartModule,
		PaymentReportGridModule,
		HeaderTitleModule
	]
})
export class PaymentReportModule {}
