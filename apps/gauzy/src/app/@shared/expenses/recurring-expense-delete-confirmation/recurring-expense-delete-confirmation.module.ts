import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbRadioModule, NbCardModule, NbButtonModule } from '@nebular/theme';
import { RecurringExpenseDeleteConfirmationComponent } from './recurring-expense-delete-confirmation.component';
import { TranslaterModule } from '../../translater/translater.module';

@NgModule({
	imports: [
		ThemeModule,
		ReactiveFormsModule,
		FormsModule,
		NbRadioModule,
		NbCardModule,
		NbButtonModule,
		TranslaterModule
	],
	exports: [RecurringExpenseDeleteConfirmationComponent],
	declarations: [RecurringExpenseDeleteConfirmationComponent],
	entryComponents: [RecurringExpenseDeleteConfirmationComponent]
})
export class RecurringExpenseDeleteConfirmationModule {}
