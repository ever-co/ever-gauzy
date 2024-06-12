import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClientBudgetsReportRoutingModule } from './client-budgets-report-routing.module';
import { ClientBudgetsReportComponent } from './client-budgets-report/client-budgets-report.component';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { GauzyFiltersModule, SharedModule, TableComponentsModule } from '@gauzy/ui-sdk/shared';
import { LineChartModule } from '../../../@shared/report/charts/line-chart/line-chart.module';
import { ProgressStatusModule } from '../../../@shared/progress-status/progress-status.module';
import { NoDataMessageModule } from '../../../@shared/no-data-message/no-data-message.module';

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
