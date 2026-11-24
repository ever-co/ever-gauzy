import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbRadioModule, NbCardModule, NbButtonModule, NbInputModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { RecurringExpenseDeleteConfirmationComponent } from './recurring-expense-delete-confirmation.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbRadioModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		TranslatePipe
	],
	exports: [RecurringExpenseDeleteConfirmationComponent],
	declarations: [RecurringExpenseDeleteConfirmationComponent]
})
export class RecurringExpenseDeleteConfirmationModule {}
