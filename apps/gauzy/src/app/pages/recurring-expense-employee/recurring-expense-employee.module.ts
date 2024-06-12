import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbSpinnerModule,
	NbTooltipModule,
	NbDialogModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { GauzyButtonActionModule } from '@gauzy/ui-sdk/shared';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '@gauzy/ui-sdk/shared';
import { RecurringExpensesEmployeeRoutingModule } from './recurring-expense-employee-routing.module';
import { RecurringExpensesEmployeeComponent } from './recurring-expense-employee.component';
import { RecurringExpenseBlockModule } from '../../@shared/expenses/recurring-expense-block/recurring-expense-block.module';
import { NoDataMessageModule } from '../../@shared/no-data-message/no-data-message.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule,
		NbDialogModule,
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		SharedModule,
		RecurringExpensesEmployeeRoutingModule,
		RecurringExpenseBlockModule,
		GauzyButtonActionModule,
		NoDataMessageModule
	],
	declarations: [RecurringExpensesEmployeeComponent]
})
export class RecurringExpensesEmployeeModule {}
