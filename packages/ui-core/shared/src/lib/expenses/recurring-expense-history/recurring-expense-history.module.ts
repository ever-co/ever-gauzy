import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { AngularSmartTableModule } from '../../smart-table/smart-table.module';
import { SharedModule } from '../../shared.module';
import { TableComponentsModule } from '../../table-components/table-components.module';
import { RecurringExpenseHistoryComponent } from './recurring-expense-history.component';

@NgModule({
	imports: [
		CommonModule,
		NbIconModule,
		TranslateModule.forChild(),
		AngularSmartTableModule,
		SharedModule,
		TableComponentsModule
	],
	exports: [RecurringExpenseHistoryComponent],
	declarations: [RecurringExpenseHistoryComponent]
})
export class RecurringExpenseHistoryModule {}
