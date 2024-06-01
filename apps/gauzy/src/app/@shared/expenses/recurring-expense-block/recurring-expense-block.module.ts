import { NgModule } from '@angular/core';
import { NbIconModule, NbTooltipModule } from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { RecurringExpenseHistoryModule } from '../recurring-expense-history/recurring-expense-history.module';
import { RecurringExpenseBlockComponent } from './recurring-expense-block.component';
import { SharedModule } from '../../shared.module';

@NgModule({
	imports: [
		ThemeModule,
		Angular2SmartTableModule,
		NbIconModule,
		NbTooltipModule,
		RecurringExpenseHistoryModule,
		TranslateModule.forChild(),
		SharedModule
	],
	exports: [RecurringExpenseBlockComponent],
	declarations: [RecurringExpenseBlockComponent],
	providers: []
})
export class RecurringExpenseBlockModule {}
