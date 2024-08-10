import { NgModule } from '@angular/core';
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
import { TranslateModule } from '@ngx-translate/core';
import { RecurringExpenseBlockModule, SmartDataViewLayoutModule, SharedModule } from '@gauzy/ui-core/shared';
import { RecurringExpensesEmployeeRoutingModule } from './recurring-expense-employee-routing.module';
import { RecurringExpensesEmployeeComponent } from './recurring-expense-employee.component';

@NgModule({
	imports: [
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule,
		NbDialogModule,
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		SharedModule,
		RecurringExpensesEmployeeRoutingModule,
		RecurringExpenseBlockModule,
		SmartDataViewLayoutModule
	],
	declarations: [RecurringExpensesEmployeeComponent]
})
export class RecurringExpensesEmployeeModule {}
