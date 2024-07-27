import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpensesReportRoutingModule } from './expenses-report-routing.module';
import { ExpensesReportComponent } from './expenses-report/expenses-report.component';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import {
	ExpenseCategorySelectModule,
	ExpensesReportGridModule,
	GauzyFiltersModule,
	LineChartModule,
	SharedModule
} from '@gauzy/ui-core/shared';

@NgModule({
	declarations: [ExpensesReportComponent],
	imports: [
		CommonModule,
		ExpensesReportRoutingModule,
		TranslateModule.forChild(),
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
