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
	NbToastrModule
} from '@nebular/theme';
import { CKEditorModule } from 'ckeditor4-angular';
import { AddTaskDialogComponent } from './add-task-dialog.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';
import { TaskPrioritySelectModule } from '../task-priority-select/task-priority-select.module';
import { TaskSizeSelectModule } from '../task-size-select/task-size-select.module';
import { TaskStatusSelectModule } from '../task-status-select/task-status-select.module';
import { TaskNumberFieldModule } from '../task-number/task-number-field.module';
import { ProjectSelectModule } from '../../selectors';
import { TaskSelectModule } from '../task-select/task-select.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		CKEditorModule,
		NbButtonModule,
		NbCardModule,
		NbDatepickerModule,
		NbDialogModule.forRoot(),
		NbIconModule,
		NbInputModule,
		NbRadioModule,
		NbSelectModule,
		NbToastrModule,
		NgSelectModule,
		TranslateModule.forChild(),
		EmployeeMultiSelectModule,
		TagsColorInputModule,
		ProjectSelectModule,
		TaskStatusSelectModule,
		TaskPrioritySelectModule,
		TaskSizeSelectModule,
		TaskNumberFieldModule,
		TaskSelectModule
	],
	declarations: [AddTaskDialogComponent],
	exports: [AddTaskDialogComponent]
})
export class AddTaskDialogModule {}
