import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectBudgetsReportRoutingModule } from './project-budgets-report-routing.module';
import { ProjectBudgetsReportComponent } from './project-budgets-report/project-budgets-report.component';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { LineChartModule } from '../../../@shared/report/charts/line-chart/line-chart.module';
import { GauzyFiltersModule, SharedModule } from '@gauzy/ui-sdk/shared';
import { ProgressStatusModule } from '../../../@shared/progress-status/progress-status.module';
import { ProjectColumnViewModule } from '../../../@shared/report/project-column-view/project-column-view.module';
import { NoDataMessageModule } from '../../../@shared/no-data-message/no-data-message.module';

@NgModule({
	declarations: [ProjectBudgetsReportComponent],
	imports: [
		CommonModule,
		ProjectBudgetsReportRoutingModule,
		SharedModule,
		I18nTranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		FormsModule,
		LineChartModule,
		ProgressStatusModule,
		GauzyFiltersModule,
		ProjectColumnViewModule,
		NoDataMessageModule
	]
})
export class ProjectBudgetsReportModule {}
