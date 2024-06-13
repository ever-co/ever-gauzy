import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	GauzyFiltersModule,
	LineChartModule,
	NoDataMessageModule,
	ProgressStatusModule,
	SharedModule,
	TableComponentsModule
} from '@gauzy/ui-sdk/shared';
import { ClientBudgetsReportRoutingModule } from './client-budgets-report-routing.module';
import { ClientBudgetsReportComponent } from './client-budgets-report/client-budgets-report.component';

@NgModule({
	declarations: [ClientBudgetsReportComponent],
	imports: [
		CommonModule,
		ClientBudgetsReportRoutingModule,
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
		TableComponentsModule,
		NoDataMessageModule
	]
})
export class ClientBudgetsReportModule {}
