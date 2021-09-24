import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
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
import { ProjectSelectModule } from '../../project-select/project-select.module';
import { TaskStatusSelectModule } from '../task-status-select/task-status-select.module';
import { SharedModule } from '../../shared.module';

@NgModule({
	declarations: [AddTaskDialogComponent],
	exports: [AddTaskDialogComponent],
	imports: [
		CommonModule,
		FormsModule,
		TranslateModule,
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
		SharedModule
	]
})
export class AddTaskDialogModule {}
