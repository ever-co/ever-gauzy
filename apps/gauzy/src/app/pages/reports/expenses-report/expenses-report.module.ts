import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpensesReportRoutingModule } from './expenses-report-routing.module';
import { ExpensesReportComponent } from './expenses-report/expenses-report.component';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ExpensesReportGridModule } from '../../../@shared/report/expenses-report-grid/expenses-report-grid.module';
import { LineChartModule } from '../../../@shared/report/charts/line-chart/line-chart.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';
import { SharedModule } from '../../../@shared/shared.module';
import { DateRangeTitleModule } from '../../../@shared/components/date-range-title/date-range-title.module';
import { GauzyFiltersModule } from '../../../@shared/timesheet/gauzy-filters/gauzy-filters.module';
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
		HeaderTitleModule,
		DateRangeTitleModule,
		GauzyFiltersModule,
		ExpenseCategorySelectModule
	]
})
export class ExpensesReportModule {}
