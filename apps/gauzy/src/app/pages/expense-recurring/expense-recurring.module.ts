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
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { RecurringExpenseBlockModule, SmartDataViewLayoutModule, SharedModule } from '@gauzy/ui-core/shared';
import { ExpenseRecurringRoutingModule } from './expense-recurring-routing.module';
import { ExpenseRecurringComponent } from './expense-recurring.component';

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
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		RecurringExpenseBlockModule,
		SmartDataViewLayoutModule
	],
	declarations: [ExpenseRecurringComponent]
})
export class ExpenseRecurringModule {}
