import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbRadioModule, NbCardModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { RecurringExpenseDeleteConfirmationComponent } from './recurring-expense-delete-confirmation.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbRadioModule,
		NbCardModule,
		NbButtonModule,
		TranslateModule.forChild()
	],
	exports: [RecurringExpenseDeleteConfirmationComponent],
	declarations: [RecurringExpenseDeleteConfirmationComponent]
})
export class RecurringExpenseDeleteConfirmationModule {}
