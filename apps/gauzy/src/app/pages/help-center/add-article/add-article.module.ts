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
import { CKEditorModule } from 'ckeditor4-angular';
import { HelpCenterArticleService } from '@gauzy/ui-sdk/core';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { EmployeeMultiSelectModule } from '@gauzy/ui-sdk/shared';
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
		CKEditorModule,
		I18nTranslateModule.forChild(),
		EmployeeMultiSelectModule
	],
	providers: [HelpCenterArticleService],
	declarations: [AddArticleComponent],
	exports: [AddArticleComponent]
})
export class AddArticleModule {}
