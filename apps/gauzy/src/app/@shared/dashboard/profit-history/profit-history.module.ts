import { NgModule } from '@angular/core';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { IncomeModule } from '../../../pages/income/income.module';
import { NbIconModule, NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { ProfitHistoryComponent } from './profit-history.component';
import { ExpenseTableComponent } from './table-components/expense-table.component';
import { IncomeTableComponent } from './table-components/income-table.component';
import { TranslaterModule } from '../../translater/translater.module';

@NgModule({
	imports: [
		Ng2SmartTableModule,
		IncomeModule,
		NbIconModule,
		NbCardModule,
		NbSpinnerModule,
		TranslaterModule
	],
	exports: [ProfitHistoryComponent],
	declarations: [
		ProfitHistoryComponent,
		ExpenseTableComponent,
		IncomeTableComponent
	],
	entryComponents: [
		ProfitHistoryComponent,
		ExpenseTableComponent,
		IncomeTableComponent
	],
	providers: [ProfitHistoryComponent]
})
export class ProfitHistoryModule {}
