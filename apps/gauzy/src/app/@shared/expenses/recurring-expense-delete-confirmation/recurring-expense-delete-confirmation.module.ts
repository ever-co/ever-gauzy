import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbRadioModule, NbCardModule, NbButtonModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { RecurringExpenseDeleteConfirmationComponent } from './recurring-expense-delete-confirmation.component';

@NgModule({
	imports: [
		ThemeModule,
		ReactiveFormsModule,
		FormsModule,
		NbRadioModule,
		NbCardModule,
		NbButtonModule,
		I18nTranslateModule.forChild()
	],
	exports: [RecurringExpenseDeleteConfirmationComponent],
	declarations: [RecurringExpenseDeleteConfirmationComponent]
})
export class RecurringExpenseDeleteConfirmationModule {}
