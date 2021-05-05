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
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';

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
		ProgressStatusModule,
		HeaderTitleModule
	]
})
export class ProjectBudgetsReportModule {}
