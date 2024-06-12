import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpensesReportRoutingModule } from './expenses-report-routing.module';
import { ExpensesReportComponent } from './expenses-report/expenses-report.component';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { GauzyFiltersModule, SharedModule } from '@gauzy/ui-sdk/shared';
import { ExpensesReportGridModule } from '../../../@shared/report/expenses-report-grid/expenses-report-grid.module';
import { LineChartModule } from '../../../@shared/report/charts/line-chart/line-chart.module';
import { ExpenseCategorySelectModule } from '../../../@shared/expenses/expense-category-select/expense-category-select.module';

@NgModule({
	declarations: [ExpensesReportComponent],
	imports: [
		CommonModule,
		ExpensesReportRoutingModule,
		I18nTranslateModule.forChild(),
		SharedModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		FormsModule,
		ExpensesReportGridModule,
		LineChartModule,
		GauzyFiltersModule,
		ExpenseCategorySelectModule
	]
})
export class ExpensesReportModule {}
