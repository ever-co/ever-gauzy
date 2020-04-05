import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { NbIconModule, NbTooltipModule, NbBadgeModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory } from '../../@theme/components/header/selectors/selectors.module';
import { DateViewComponent } from './date-view/date-view.component';
import { IncomeExpenseAmountComponent } from './income-amount/income-amount.component';
import { NotesWithTagsComponent } from './notes-with-tags/notes-with-tags.component';

@NgModule({
	imports: [
		CommonModule,
		NbIconModule,
		NbTooltipModule,
		NbBadgeModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	entryComponents: [
		DateViewComponent,
		IncomeExpenseAmountComponent,
		NotesWithTagsComponent
	],
	declarations: [
		DateViewComponent,
		IncomeExpenseAmountComponent,
		NotesWithTagsComponent
	],
	providers: []
})
export class TableComponentsModule {}
