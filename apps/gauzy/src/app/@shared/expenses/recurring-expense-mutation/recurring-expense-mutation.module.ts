import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDatepickerModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { OrganizationsService } from '@gauzy/ui-sdk/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { RecurringExpenseMutationComponent } from './recurring-expense-mutation.component';
import { EmployeeSelectorsModule } from '../../../@theme/components/header/selectors/employee/employee.module';
import { CurrencyModule } from '../../currency/currency.module';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		NbDatepickerModule,
		NgSelectModule,
		NbSelectModule,
		NbTooltipModule,
		NbCheckboxModule,
		NbAlertModule,
		NbSpinnerModule,
		EmployeeSelectorsModule,
		TranslateModule.forChild(),
		CurrencyModule
	],
	exports: [RecurringExpenseMutationComponent],
	declarations: [RecurringExpenseMutationComponent],
	providers: [OrganizationsService]
})
export class RecurringExpenseMutationModule {}
