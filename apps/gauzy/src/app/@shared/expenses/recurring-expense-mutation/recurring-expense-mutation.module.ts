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
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { ThemeModule } from '../../../@theme/theme.module';
import { RecurringExpenseMutationComponent } from './recurring-expense-mutation.component';
import { EmployeeSelectorsModule } from '../../../@theme/components/header/selectors/employee/employee.module';
import { CurrencyModule } from '../../currency/currency.module';
import { TranslateModule } from '../../translate/translate.module';
import { SharedModule } from '../../shared.module';

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
		TranslateModule,
		CurrencyModule,
		SharedModule
	],
	exports: [RecurringExpenseMutationComponent],
	declarations: [RecurringExpenseMutationComponent],
	providers: [OrganizationsService]
})
export class RecurringExpenseMutationModule {}
