import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule, NbTooltipModule } from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { RecurringExpenseHistoryModule } from '../recurring-expense-history/recurring-expense-history.module';
import { RecurringExpenseBlockComponent } from './recurring-expense-block.component';

@NgModule({
	imports: [
		CommonModule,
		NbIconModule,
		NbTooltipModule,
		Angular2SmartTableModule,
		I18nTranslateModule.forChild(),
		SharedModule,
		RecurringExpenseHistoryModule
	],
	exports: [RecurringExpenseBlockComponent],
	declarations: [RecurringExpenseBlockComponent]
})
export class RecurringExpenseBlockModule {}
