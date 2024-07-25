import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule } from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { TableComponentsModule } from '../../table-components/table-components.module';
import { RecurringExpenseHistoryComponent } from './recurring-expense-history.component';

@NgModule({
	imports: [
		CommonModule,
		NbIconModule,
		Angular2SmartTableModule,
		TranslateModule.forChild(),
		SharedModule,
		TableComponentsModule
	],
	exports: [RecurringExpenseHistoryComponent],
	declarations: [RecurringExpenseHistoryComponent]
})
export class RecurringExpenseHistoryModule {}
