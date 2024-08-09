import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule, NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { AngularSmartTableModule } from '../../smart-table/smart-table.module';
import { ProfitHistoryComponent } from './profit-history.component';
import { ExpenseTableComponent } from './table-components/expense-table.component';
import { IncomeTableComponent } from './table-components/income-table.component';

@NgModule({
	imports: [
		CommonModule,
		NbIconModule,
		NbCardModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		AngularSmartTableModule
	],
	exports: [ProfitHistoryComponent],
	declarations: [ProfitHistoryComponent, ExpenseTableComponent, IncomeTableComponent]
})
export class ProfitHistoryModule {}
