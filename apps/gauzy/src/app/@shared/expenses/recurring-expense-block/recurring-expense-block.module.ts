import { NgModule } from '@angular/core';
import { NbIconModule, NbTooltipModule } from '@nebular/theme';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { ThemeModule } from '../../../@theme/theme.module';
import { RecurringExpenseHistoryModule } from '../recurring-expense-history/recurring-expense-history.module';
import { RecurringExpenseBlockComponent } from './recurring-expense-block.component';
import { TranslateModule } from '../../translate/translate.module';
import { SharedModule } from '../../shared.module';

@NgModule({
	imports: [
		ThemeModule,
		Ng2SmartTableModule,
		NbIconModule,
		NbTooltipModule,
		RecurringExpenseHistoryModule,
		TranslateModule,
		SharedModule
	],
	exports: [RecurringExpenseBlockComponent],
	declarations: [RecurringExpenseBlockComponent],
	providers: []
})
export class RecurringExpenseBlockModule {}
