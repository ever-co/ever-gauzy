import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { NbIconModule, NbTooltipModule, NbBadgeModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory } from '../../@theme/components/header/selectors/selectors.module';
import { DateViewComponent } from './date-view/date-view.component';
import { IncomeExpenseAmountComponent } from './income-amount/income-amount.component';
import { NotesWithTagsComponent } from './notes-with-tags/notes-with-tags.component';
import { PictureNameTagsComponent } from './picture-name-tags/picture-name-tags.component';

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
		NotesWithTagsComponent,
		PictureNameTagsComponent
	],
	declarations: [
		DateViewComponent,
		IncomeExpenseAmountComponent,
		NotesWithTagsComponent,
		PictureNameTagsComponent
	],
	providers: []
})
export class TableComponentsModule {}
