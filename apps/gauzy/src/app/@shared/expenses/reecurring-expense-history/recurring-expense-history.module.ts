import { NgModule } from '@angular/core';
import { RecurringExpenseHistoryComponent } from './recurring-expense-history.component';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { NbIconModule } from '@nebular/theme';
import { DateViewComponent } from '../../table-components/date-view/date-view.component';
import { IncomeExpenseAmountComponent } from '../../table-components/income-amount/income-amount.component';
import { TableComponentsModule } from '../../table-components/table-components.module';
import { ThemeModule } from '../../../@theme/theme.module';

@NgModule({
	imports: [ThemeModule, Ng2SmartTableModule, TableComponentsModule],
	exports: [RecurringExpenseHistoryComponent],
	declarations: [RecurringExpenseHistoryComponent],
	entryComponents: [
		RecurringExpenseHistoryComponent,
		DateViewComponent,
		IncomeExpenseAmountComponent
	],
	providers: []
})
export class RecurringExpenseHistoryModule {}
