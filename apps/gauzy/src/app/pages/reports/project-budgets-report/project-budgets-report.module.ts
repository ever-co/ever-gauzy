import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ProjectBudgetsReportRoutingModule } from './project-budgets-report-routing.module';
import { ProjectBudgetsReportComponent } from './project-budgets-report/project-budgets-report.component';
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
	declarations: [ProjectBudgetsReportComponent],
	imports: [
		CommonModule,
		ProjectBudgetsReportRoutingModule,
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
export class ProjectBudgetsReportModule {}
