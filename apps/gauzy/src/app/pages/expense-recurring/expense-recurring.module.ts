import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { DirectivesModule } from '@gauzy/ui-sdk/shared';
import { NgxPermissionsModule } from 'ngx-permissions';
import { ThemeModule } from '../../@theme/theme.module';
import { ExpenseRecurringRoutingModule } from './expense-recurring-routing.module';
import { ExpenseRecurringComponent } from './expense-recurring.component';
import { RecurringExpenseBlockModule } from '../../@shared/expenses/recurring-expense-block/recurring-expense-block.module';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { GauzyButtonActionModule } from '../../@shared/gauzy-button-action/gauzy-button-action.module';
import { NoDataMessageModule } from '../../@shared/no-data-message/no-data-message.module';

@NgModule({
	imports: [
		ExpenseRecurringRoutingModule,
		ThemeModule,
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
		HeaderTitleModule,
		NgxPermissionsModule.forChild(),
		GauzyButtonActionModule,
		NoDataMessageModule,
		DirectivesModule
	],
	declarations: [ExpenseRecurringComponent]
})
export class ExpenseRecurringModule {}
