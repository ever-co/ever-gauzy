import { NgModule } from '@angular/core';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { RecurringExpensesEmployeeRoutingModule } from './recurring-expense-employee-routing.module';
import { RecurringExpensesEmployeeComponent } from './recurring-expense-employee.component';
import { RecurringExpenseBlockModule } from '../../@shared/expenses/recurring-expense-block/recurring-expense-block.module';
import { NgxPermissionsModule } from 'ngx-permissions';

@NgModule({
	imports: [
		RecurringExpensesEmployeeRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		RecurringExpenseBlockModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NgxPermissionsModule.forChild()
	],
	declarations: [RecurringExpensesEmployeeComponent],
	entryComponents: []
})
export class RecurringExpensesEmployeeModule {}
