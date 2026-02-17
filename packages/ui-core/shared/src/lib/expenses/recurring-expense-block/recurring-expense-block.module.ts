import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { SmartDataViewLayoutModule } from '../../smart-data-layout/smart-data-view-layout.module';
import { RecurringExpenseHistoryModule } from '../recurring-expense-history/recurring-expense-history.module';
import { RecurringExpenseBlockComponent } from './recurring-expense-block.component';
import { CurrencyPositionPipe } from '../../pipes/currency-position.pipe';

@NgModule({
	imports: [
		CommonModule,
		CurrencyPositionPipe,
		NbIconModule,
		NbTooltipModule,
		TranslateModule.forChild(),
		SharedModule,
		SmartDataViewLayoutModule,
		RecurringExpenseHistoryModule
	],
	exports: [RecurringExpenseBlockComponent],
	declarations: [RecurringExpenseBlockComponent]
})
export class RecurringExpenseBlockModule {}
