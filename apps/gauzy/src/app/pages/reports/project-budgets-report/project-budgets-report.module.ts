import { NgModule } from '@angular/core';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import {
	GauzyFiltersModule,
	LineChartModule,
	NoDataMessageModule,
	ProgressStatusModule,
	ProjectColumnViewModule,
	SharedModule
} from '@gauzy/ui-core/shared';
import { ProjectBudgetsReportRoutingModule } from './project-budgets-report-routing.module';
import { ProjectBudgetsReportComponent } from './project-budgets-report/project-budgets-report.component';

@NgModule({
	declarations: [ProjectBudgetsReportComponent],
	imports: [
		ProjectBudgetsReportRoutingModule,
		SharedModule,
		TranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		LineChartModule,
		ProgressStatusModule,
		GauzyFiltersModule,
		ProjectColumnViewModule,
		NoDataMessageModule,
		NbButtonModule
	]
})
export class ProjectBudgetsReportModule {}
