import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { HttpLoaderFactory, ThemeModule } from '../../../@theme/theme.module';
import { DateViewComponent } from '../../table-components/date-view/date-view.component';
import { IncomeExpenseAmountComponent } from '../../table-components/income-amount/income-amount.component';
import { TableComponentsModule } from '../../table-components/table-components.module';
import { RecurringExpenseHistoryModule } from '../recurring-expense-history/recurring-expense-history.module';
import { RecurringExpenseBlockComponent } from './recurring-expense-block.component';
import { PictureNameTagsComponent } from '../../table-components/picture-name-tags/picture-name-tags.component';

@NgModule({
	imports: [
		ThemeModule,
		Ng2SmartTableModule,
		TableComponentsModule,
		NbIconModule,
		NbTooltipModule,
		RecurringExpenseHistoryModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [RecurringExpenseBlockComponent],
	declarations: [RecurringExpenseBlockComponent],
	entryComponents: [
		RecurringExpenseBlockComponent,
		DateViewComponent,
		IncomeExpenseAmountComponent,
		PictureNameTagsComponent
	],
	providers: []
})
export class RecurringExpenseBlockModule {}
