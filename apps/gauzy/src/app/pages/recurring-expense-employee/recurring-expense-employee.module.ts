import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { RecurringExpensesEmployeeRoutingModule } from './recurring-expense-employee-routing.module';
import { RecurringExpensesEmployeeComponent } from './recurring-expense-employee.component';
import { RecurringExpenseBlockModule } from '../../@shared/expenses/recurring-expense-block/recurring-expense-block.module';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslaterModule } from '../../@shared/translater/translater.module';

@NgModule({
	imports: [
		RecurringExpensesEmployeeRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		RecurringExpenseBlockModule,
		NbDialogModule.forChild(),
		TranslaterModule,
		NgxPermissionsModule.forChild()
	],
	declarations: [RecurringExpensesEmployeeComponent],
	entryComponents: []
})
export class RecurringExpensesEmployeeModule {}
