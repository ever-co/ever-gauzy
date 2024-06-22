import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpensesReportRoutingModule } from './expenses-report-routing.module';
import { ExpensesReportComponent } from './expenses-report/expenses-report.component';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	ExpenseCategorySelectModule,
	ExpensesReportGridModule,
	i4netFiltersModule,
	LineChartModule,
	SharedModule
} from '@gauzy/ui-core/shared';

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
		i4netFiltersModule,
		ExpenseCategorySelectModule
	]
})
export class ExpensesReportModule { }
