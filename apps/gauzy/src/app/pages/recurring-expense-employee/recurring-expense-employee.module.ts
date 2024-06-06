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
import { FormsModule } from '@angular/forms';
import { NgxPermissionsModule } from 'ngx-permissions';
import { DirectivesModule } from '@gauzy/ui-sdk/shared';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../@theme/theme.module';
import { RecurringExpensesEmployeeRoutingModule } from './recurring-expense-employee-routing.module';
import { RecurringExpensesEmployeeComponent } from './recurring-expense-employee.component';
import { RecurringExpenseBlockModule } from '../../@shared/expenses/recurring-expense-block/recurring-expense-block.module';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { GauzyButtonActionModule } from '../../@shared/gauzy-button-action/gauzy-button-action.module';
import { NoDataMessageModule } from '../../@shared/no-data-message/no-data-message.module';

@NgModule({
	imports: [
		RecurringExpensesEmployeeRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule,
		RecurringExpenseBlockModule,
		NbDialogModule.forChild(),
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		HeaderTitleModule,
		GauzyButtonActionModule,
		NoDataMessageModule,
		DirectivesModule
	],
	declarations: [RecurringExpensesEmployeeComponent]
})
export class RecurringExpensesEmployeeModule {}
