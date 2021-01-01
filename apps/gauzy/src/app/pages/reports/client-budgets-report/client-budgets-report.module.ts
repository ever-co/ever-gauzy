import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ClientBudgetsReportRoutingModule } from './client-budgets-report-routing.module';
import { ClientBudgetsReportComponent } from './client-budgets-report/client-budgets-report.component';
import { FormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbSelectModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { LineChartModule } from '../../../@shared/report/charts/line-chart/line-chart.module';
import { SharedModule } from '../../../@shared/shared.module';
import { FiltersModule } from '../../../@shared/timesheet/filters/filters.module';
import { ProgressStatusModule } from '../../../@shared/progress-status/progress-status.module';

@NgModule({
	declarations: [ClientBudgetsReportComponent],
	imports: [
		CommonModule,
		ClientBudgetsReportRoutingModule,
		SharedModule,
		TranslateModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		FiltersModule,
		NbSelectModule,
		FormsModule,
		LineChartModule,
		ProgressStatusModule
	]
})
export class ClientBudgetsReportModule {}
