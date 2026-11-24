import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import {
	RecordViewModule,
	RecurringExpenseBlockModule,
	SmartDataViewLayoutModule,
	SharedModule,
	TableComponentsModule
} from '@gauzy/ui-core/shared';
import { ExpenseRecurringRoutingModule } from './expense-recurring-routing.module';
import { ExpenseRecurringComponent } from './expense-recurring.component';
import { RecurringExpenseViewPageComponent } from './recurring-expense-view/recurring-expense-view-page.component';

@NgModule({
	imports: [
		ExpenseRecurringRoutingModule,
		SharedModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule,
		NbDialogModule.forChild(),
		NgxPermissionsModule.forChild(),
		TranslatePipe,
		RecurringExpenseBlockModule,
		RecordViewModule,
		SmartDataViewLayoutModule,
		// The page's amounts, drawn as the grids draw them
		TableComponentsModule
	],
	declarations: [ExpenseRecurringComponent, RecurringExpenseViewPageComponent]
})
export class ExpenseRecurringModule {}
