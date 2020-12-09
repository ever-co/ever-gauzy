import { HttpLoaderFactory, ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbRadioModule, NbCardModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { RecurringExpenseDeleteConfirmationComponent } from './recurring-expense-delete-confirmation.component';

@NgModule({
	imports: [
		ThemeModule,
		ReactiveFormsModule,
		FormsModule,
		NbRadioModule,
		NbCardModule,
		NbButtonModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [RecurringExpenseDeleteConfirmationComponent],
	declarations: [RecurringExpenseDeleteConfirmationComponent],
	entryComponents: [RecurringExpenseDeleteConfirmationComponent]
})
export class RecurringExpenseDeleteConfirmationModule {}
