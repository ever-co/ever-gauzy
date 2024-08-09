import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { AngularSmartTableModule } from '../../smart-table/smart-table.module';
import { RecurringExpenseHistoryModule } from '../recurring-expense-history/recurring-expense-history.module';
import { RecurringExpenseBlockComponent } from './recurring-expense-block.component';

@NgModule({
	imports: [
		CommonModule,
		NbIconModule,
		NbTooltipModule,
		AngularSmartTableModule,
		TranslateModule.forChild(),
		SharedModule,
		RecurringExpenseHistoryModule
	],
	exports: [RecurringExpenseBlockComponent],
	declarations: [RecurringExpenseBlockComponent]
})
export class RecurringExpenseBlockModule {}
