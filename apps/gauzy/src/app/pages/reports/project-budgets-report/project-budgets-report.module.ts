import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ProjectBudgetsReportRoutingModule } from './project-budgets-report-routing.module';
import { ProjectBudgetsReportComponent } from './project-budgets-report/project-budgets-report.component';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { LineChartModule } from '../../../@shared/report/charts/line-chart/line-chart.module';
import { SharedModule } from '../../../@shared/shared.module';
import { ProgressStatusModule } from '../../../@shared/progress-status/progress-status.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';
import { DateRangeTitleModule } from '../../../@shared/components/date-range-title/date-range-title.module';
import { GauzyFiltersModule } from '../../../@shared/timesheet/gauzy-filters/gauzy-filters.module';
import { ProjectColumnViewModule } from '../../../@shared/report/project-column-view/project-column-view.module';
import { NoDataMessageModule } from '../../../@shared/no-data-message/no-data-message.module';

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
		NbSelectModule,
		FormsModule,
		LineChartModule,
		ProgressStatusModule,
		HeaderTitleModule,
		DateRangeTitleModule,
		GauzyFiltersModule,
		ProjectColumnViewModule,
		NoDataMessageModule
	]
})
export class ProjectBudgetsReportModule {}
