import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { SmartDataViewLayoutModule } from '../../smart-data-layout/smart-data-view-layout.module';
import { TableComponentsModule } from '../../table-components/table-components.module';
import { RecurringExpenseHistoryComponent } from './recurring-expense-history.component';
import { RecurringExpenseHistoryDialogComponent } from './recurring-expense-history-dialog.component';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		TranslatePipe,
		SharedModule,
		SmartDataViewLayoutModule,
		TableComponentsModule
	],
	exports: [RecurringExpenseHistoryComponent, RecurringExpenseHistoryDialogComponent],
	declarations: [RecurringExpenseHistoryComponent, RecurringExpenseHistoryDialogComponent]
})
export class RecurringExpenseHistoryModule {}
