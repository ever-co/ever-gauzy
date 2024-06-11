import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { AddTaskDialogComponent } from './add-task-dialog.component';
import {
	NbToastrModule,
	NbDialogModule,
	NbCardModule,
	NbIconModule,
	NbRadioModule,
	NbSelectModule,
	NbDatepickerModule,
	NbInputModule,
	NbButtonModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';
import { TaskPrioritySelectModule } from '../task-priority-select/task-priority-select.module';
import { TaskSizeSelectModule } from '../task-size-select/task-size-select.module';
import { TaskStatusSelectModule } from '../task-status-select/task-status-select.module';
import { TaskNumberFieldModule } from '../task-number/task-number-field.module';
import { CKEditorModule } from 'ckeditor4-angular';
import { ProjectSelectModule } from '../../selectors/project-select/project-select.module';

@NgModule({
	declarations: [AddTaskDialogComponent],
	exports: [AddTaskDialogComponent],
	imports: [
		CommonModule,
		FormsModule,
		I18nTranslateModule.forChild(),
		NbToastrModule,
		NbDialogModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbIconModule,
		NgSelectModule,
		NbRadioModule,
		EmployeeMultiSelectModule,
		NbSelectModule,
		TagsColorInputModule,
		NbDatepickerModule,
		NbInputModule,
		NbButtonModule,
		ProjectSelectModule,
		TaskStatusSelectModule,
		TaskPrioritySelectModule,
		TaskSizeSelectModule,
		TaskNumberFieldModule,
		CKEditorModule
	]
})
export class AddTaskDialogModule {}
