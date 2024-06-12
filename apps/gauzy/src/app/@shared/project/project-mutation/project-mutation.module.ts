import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbDatepickerModule,
	NbInputModule,
	NbListModule,
	NbSelectModule,
	NbTabsetModule,
	NbToggleModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { CKEditorModule } from 'ckeditor4-angular';
import { ColorPickerModule } from 'ngx-color-picker';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	CurrencyModule,
	EmployeeMultiSelectModule,
	ImageUploaderModule,
	SharedModule,
	TagsColorInputModule,
	TeamSelectModule
} from '@gauzy/ui-sdk/shared';
import { ProjectMutationComponent } from './project-mutation.component';
import { RepositorySelectorModule } from '../../integrations/github';

@NgModule({
	declarations: [ProjectMutationComponent],
	exports: [ProjectMutationComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbCardModule,
		NbDatepickerModule,
		NbInputModule,
		NbListModule,
		NbSelectModule,
		NbTabsetModule,
		NbToggleModule,
		NgSelectModule,
		CKEditorModule,
		ColorPickerModule,
		SharedModule,
		I18nTranslateModule.forChild(),
		CurrencyModule,
		EmployeeMultiSelectModule,
		ImageUploaderModule,
		TagsColorInputModule,
		TeamSelectModule,
		RepositorySelectorModule
	]
})
export class ProjectMutationModule {}
