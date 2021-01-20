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
import { CKEditorModule } from 'ng2-ckeditor';
import { HelpCenterArticleService } from '../../../@core/services/help-center-article.service';
import { TranslaterModule } from '../../../@shared/translater/translater.module';

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
		TranslaterModule
	],
	providers: [HelpCenterArticleService],
	entryComponents: [AddArticleComponent],
	declarations: [AddArticleComponent],
	exports: [AddArticleComponent]
})
export class AddArticleModule {}
