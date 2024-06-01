import { EmployeeMultiSelectModule } from './../../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { ThemeModule } from '../../../@theme/theme.module';
import {
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbSelectModule,
	NbInputModule,
	NbToggleModule
} from '@nebular/theme';
import { AddArticleComponent } from './add-article.component';
import { CKEditorModule } from 'ckeditor4-angular';
import { HelpCenterArticleService } from '../../../@core/services/help-center-article.service';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';

@NgModule({
	imports: [
		CKEditorModule,
		ThemeModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbButtonModule,
		NbSelectModule,
		NbToggleModule,
		FormsModule,
		ReactiveFormsModule,
		EmployeeMultiSelectModule,
		TranslateModule.forChild()
	],
	providers: [HelpCenterArticleService],
	declarations: [AddArticleComponent],
	exports: [AddArticleComponent]
})
export class AddArticleModule {}
