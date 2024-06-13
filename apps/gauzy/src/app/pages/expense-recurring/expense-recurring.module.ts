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
import {
	GauzyButtonActionModule,
	NoDataMessageModule,
	RecurringExpenseBlockModule,
	SharedModule
} from '@gauzy/ui-sdk/shared';
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
		I18nTranslateModule.forChild(),
		RecurringExpenseBlockModule,
		GauzyButtonActionModule,
		NoDataMessageModule
	],
	declarations: [ExpenseRecurringComponent]
})
export class ExpenseRecurringModule {}
