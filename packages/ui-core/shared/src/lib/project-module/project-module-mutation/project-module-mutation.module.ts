import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbDatepickerModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbRadioModule,
	NbSelectModule,
	NbToastrModule,
	NbToggleModule
} from '@nebular/theme';
import { CKEditorModule } from 'ckeditor4-angular';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { TaskSelectModule, TaskStatusSelectModule } from '../../tasks';
import { ProjectSelectModule, SelectorsModule } from '../../selectors';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';
import { ProjectModuleMutationComponent } from './project-module-mutation.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		CKEditorModule,
		NbButtonModule,
		NbCardModule,
		NbDatepickerModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbInputModule,
		NbToggleModule,
		NbRadioModule,
		NbSelectModule,
		NbToastrModule,
		NgSelectModule,
		SelectorsModule,
		TranslateModule.forChild(),
		EmployeeMultiSelectModule,
		TagsColorInputModule,
		ProjectSelectModule,
		TaskSelectModule,
		TaskStatusSelectModule
	],
	declarations: [ProjectModuleMutationComponent],
	exports: [ProjectModuleMutationComponent]
})
export class ProjectModuleMutationModule {}
