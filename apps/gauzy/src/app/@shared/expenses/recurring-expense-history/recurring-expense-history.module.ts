import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { NbIconModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { HttpLoaderFactory, ThemeModule } from '../../../@theme/theme.module';
import { DateViewComponent } from '../../table-components/date-view/date-view.component';
import { IncomeExpenseAmountComponent } from '../../table-components/income-amount/income-amount.component';
import { TableComponentsModule } from '../../table-components/table-components.module';
import { RecurringExpenseHistoryComponent } from './recurring-expense-history.component';

@NgModule({
	imports: [
		ThemeModule,
		Ng2SmartTableModule,
		TableComponentsModule,
		NbIconModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [RecurringExpenseHistoryComponent],
	declarations: [RecurringExpenseHistoryComponent],
	entryComponents: [
		RecurringExpenseHistoryComponent,
		DateViewComponent,
		IncomeExpenseAmountComponent
	],
	providers: []
})
export class RecurringExpenseHistoryModule {}
