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
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import {
	GauzyButtonActionModule,
	NoDataMessageModule,
	RecurringExpenseBlockModule,
	SharedModule
} from '@gauzy/ui-core/shared';
import { ExpenseRecurringRoutingModule } from './expense-recurring-routing.module';
import { ExpenseRecurringComponent } from './expense-recurring.component';

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
		TranslateModule.forChild(),
		RecurringExpenseBlockModule,
		GauzyButtonActionModule,
		NoDataMessageModule
	],
	declarations: [ExpenseRecurringComponent]
})
export class ExpenseRecurringModule {}
