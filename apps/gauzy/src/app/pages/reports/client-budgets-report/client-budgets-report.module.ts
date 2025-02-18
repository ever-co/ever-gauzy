import { NgModule } from '@angular/core';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import {
	GauzyFiltersModule,
	LineChartModule,
	NoDataMessageModule,
	ProgressStatusModule,
	SharedModule,
	TableComponentsModule
} from '@gauzy/ui-core/shared';
import { ClientBudgetsReportRoutingModule } from './client-budgets-report-routing.module';
import { ClientBudgetsReportComponent } from './client-budgets-report/client-budgets-report.component';

@NgModule({
	declarations: [ClientBudgetsReportComponent],
	imports: [
		ClientBudgetsReportRoutingModule,
		SharedModule,
		TranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		LineChartModule,
		ProgressStatusModule,
		GauzyFiltersModule,
		TableComponentsModule,
		NoDataMessageModule,
		NbButtonModule
	]
})
export class ClientBudgetsReportModule {}
