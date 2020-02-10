import { NgModule } from '@angular/core';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { IncomeModule } from '../../../pages/income/income.module';
import { NbIconModule, NbCardModule } from '@nebular/theme';
import { ProfitHistoryComponent } from './profit-history.component';
import { ExpenseTableComponent } from './table-components/expense-table.component';
import { IncomeTableComponent } from './table-components/income-table.component';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		Ng2SmartTableModule,
		IncomeModule,
		NbIconModule,
		NbCardModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [ProfitHistoryComponent],
	declarations: [
		ProfitHistoryComponent,
		ExpenseTableComponent,
		IncomeTableComponent
	],
	entryComponents: [
		ProfitHistoryComponent,
		ExpenseTableComponent,
		IncomeTableComponent
	],
	providers: [ProfitHistoryComponent]
})
export class ProfitHistoryModule {}
