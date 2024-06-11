import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { OrganizationsService } from '@gauzy/ui-sdk/core';
import { CurrencyModule, SelectorsModule } from '@gauzy/ui-sdk/shared';
import { RecurringExpenseMutationComponent } from './recurring-expense-mutation.component';

@NgModule({
	imports: [
		CommonModule,
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
		I18nTranslateModule.forChild(),
		SelectorsModule,
		CurrencyModule
	],
	exports: [RecurringExpenseMutationComponent],
	declarations: [RecurringExpenseMutationComponent],
	providers: [OrganizationsService]
})
export class RecurringExpenseMutationModule {}
