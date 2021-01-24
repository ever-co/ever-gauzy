import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbRadioModule, NbCardModule, NbButtonModule } from '@nebular/theme';
import { RecurringExpenseDeleteConfirmationComponent } from './recurring-expense-delete-confirmation.component';
import { TranslateModule } from '../../translate/translate.module';

@NgModule({
	imports: [
		ThemeModule,
		ReactiveFormsModule,
		FormsModule,
		NbRadioModule,
		NbCardModule,
		NbButtonModule,
		TranslateModule
	],
	exports: [RecurringExpenseDeleteConfirmationComponent],
	declarations: [RecurringExpenseDeleteConfirmationComponent],
	entryComponents: [RecurringExpenseDeleteConfirmationComponent]
})
export class RecurringExpenseDeleteConfirmationModule {}
