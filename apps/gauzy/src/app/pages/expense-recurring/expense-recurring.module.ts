import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { NgxPermissionsModule } from 'ngx-permissions';
import { SharedModule } from '@gauzy/ui-sdk/shared';
import { ExpenseRecurringRoutingModule } from './expense-recurring-routing.module';
import { ExpenseRecurringComponent } from './expense-recurring.component';
import { RecurringExpenseBlockModule } from '../../@shared/expenses/recurring-expense-block/recurring-expense-block.module';
import { GauzyButtonActionModule } from '@gauzy/ui-sdk/shared';
import { NoDataMessageModule } from '../../@shared/no-data-message/no-data-message.module';

@NgModule({
	imports: [
		CommonModule,
		ExpenseRecurringRoutingModule,
		SharedModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule,
		NbDialogModule.forChild(),
		I18nTranslateModule.forChild(),
		RecurringExpenseBlockModule,
		NgxPermissionsModule.forChild(),
		GauzyButtonActionModule,
		NoDataMessageModule
	],
	declarations: [ExpenseRecurringComponent]
})
export class ExpenseRecurringModule {}
