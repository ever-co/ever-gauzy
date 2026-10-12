import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbToggleModule
} from '@nebular/theme';
import { HelpCenterArticleService } from '@gauzy/ui-core/core';
import { TranslateModule } from '@ngx-translate/core';
import { EmployeeMultiSelectModule, RichTextEditorModule } from '@gauzy/ui-core/shared';
import { AddArticleComponent } from './add-article.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbToggleModule,
		RichTextEditorModule,
		TranslateModule.forChild(),
		EmployeeMultiSelectModule
	],
	providers: [HelpCenterArticleService],
	declarations: [AddArticleComponent],
	exports: [AddArticleComponent]
})
export class AddArticleModule {}
