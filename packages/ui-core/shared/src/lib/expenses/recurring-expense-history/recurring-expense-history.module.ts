import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { SmartDataViewLayoutModule } from '../../smart-data-layout/smart-data-view-layout.module';
import { TableComponentsModule } from '../../table-components/table-components.module';
import { RecurringExpenseHistoryComponent } from './recurring-expense-history.component';

@NgModule({
	imports: [
		CommonModule,
		NbIconModule,
		TranslateModule.forChild(),
		SharedModule,
		SmartDataViewLayoutModule,
		TableComponentsModule
	],
	exports: [RecurringExpenseHistoryComponent],
	declarations: [RecurringExpenseHistoryComponent]
})
export class RecurringExpenseHistoryModule {}
