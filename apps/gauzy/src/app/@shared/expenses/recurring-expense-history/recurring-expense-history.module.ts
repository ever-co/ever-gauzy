import { NgModule } from '@angular/core';
import { NbIconModule } from '@nebular/theme';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { ThemeModule } from '../../../@theme/theme.module';
import { TableComponentsModule } from '../../table-components/table-components.module';
import { TranslateModule } from '../../translate/translate.module';
import { RecurringExpenseHistoryComponent } from './recurring-expense-history.component';

@NgModule({
	imports: [
		ThemeModule,
		Ng2SmartTableModule,
		TableComponentsModule,
		NbIconModule,
		TranslateModule
	],
	exports: [RecurringExpenseHistoryComponent],
	declarations: [RecurringExpenseHistoryComponent],
	providers: []
})
export class RecurringExpenseHistoryModule {}
