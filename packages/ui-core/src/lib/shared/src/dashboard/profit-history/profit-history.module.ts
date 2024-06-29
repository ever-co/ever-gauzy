import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule, NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { ProfitHistoryComponent } from './profit-history.component';
import { ExpenseTableComponent } from './table-components/expense-table.component';
import { IncomeTableComponent } from './table-components/income-table.component';
import { PaginationV2Module } from '../../smart-table/pagination/pagination-v2/pagination-v2.module';

@NgModule({
	imports: [
		CommonModule,
		Angular2SmartTableModule,
		NbIconModule,
		NbCardModule,
		NbSpinnerModule,
		I18nTranslateModule.forChild(),
		PaginationV2Module
	],
	exports: [ProfitHistoryComponent],
	declarations: [ProfitHistoryComponent, ExpenseTableComponent, IncomeTableComponent]
})
export class ProfitHistoryModule {}
