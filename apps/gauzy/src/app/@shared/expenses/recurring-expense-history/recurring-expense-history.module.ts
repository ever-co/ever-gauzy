import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule } from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { TableComponentsModule } from '@gauzy/ui-sdk/shared';
import { SharedModule } from '../../shared.module';
import { RecurringExpenseHistoryComponent } from './recurring-expense-history.component';

@NgModule({
	imports: [
		CommonModule,
		NbIconModule,
		Angular2SmartTableModule,
		I18nTranslateModule.forChild(),
		SharedModule,
		TableComponentsModule
	],
	exports: [RecurringExpenseHistoryComponent],
	declarations: [RecurringExpenseHistoryComponent]
})
export class RecurringExpenseHistoryModule {}
