import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { CKEditorModule } from 'ckeditor4-angular';
import { NgxPermissionsModule } from 'ngx-permissions';
import { NgSelectModule } from '@ng-select/ng-select';
import {
	NbTooltipModule,
	NbBadgeModule,
	NbCardModule,
	NbButtonModule,
	NbRadioModule,
	NbAccordionModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbTabsetModule,
	NbActionsModule,
	NbDialogModule,
	NbListModule,
	NbContextMenuModule,
	NbSpinnerModule,
	NbDatepickerModule,
	NbPopoverModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	AddTaskDialogModule,
	CardGridModule,
	EmployeeMultiSelectModule,
	GauzyButtonActionModule,
	GauzyEditableGridModule,
	PaginationV2Module,
	ProjectSelectModule,
	SharedModule,
	TableFiltersModule,
	TagsColorInputModule,
	TaskNumberFieldModule,
	TaskPrioritySelectModule,
	TaskSizeSelectModule,
	TaskStatusSelectModule,
	TasksSprintSettingsViewModule,
	UserFormsModule
} from '@gauzy/ui-core/shared';
import { TaskComponent } from './components/task/task.component';
import { TasksRoutingModule } from './tasks-routing.module';
import { TableComponentsModule } from '@gauzy/ui-core/shared';
import { MyTaskDialogComponent } from './components/my-task-dialog/my-task-dialog.component';
import { TeamTaskDialogComponent } from './components/team-task-dialog/team-task-dialog.component';
import { TaskSettingsComponent } from './components/task/task-settings/task-settings.component';
import { ProjectViewComponent } from './components/task/task-settings/project-view/project-view.component';
import { TasksSprintViewComponent } from './components/task/tasks-layouts/tasks-sprint-view/tasks-sprint-view.component';
import { SprintTaskComponent } from './components/task/tasks-layouts/tasks-sprint-view/task/task.component';

@NgModule({
	declarations: [
		TaskComponent,
		MyTaskDialogComponent,
		TeamTaskDialogComponent,
		TaskSettingsComponent,
		ProjectViewComponent,
		TasksSprintViewComponent,
		SprintTaskComponent
	],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbTooltipModule,
		NbBadgeModule,
		NbCardModule,
		NbButtonModule,
		NbRadioModule,
		NbAccordionModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbTabsetModule,
		NbActionsModule,
		NbDialogModule.forRoot(),
		NbListModule,
		NbContextMenuModule,
		NbSpinnerModule,
		NbDatepickerModule,
		NbPopoverModule,
		NgSelectModule,
		Angular2SmartTableModule,
		DragDropModule,
		NgxPermissionsModule.forChild(),
		CKEditorModule,
		I18nTranslateModule.forChild(),
		TasksRoutingModule,
		TableComponentsModule,
		TagsColorInputModule,
		SharedModule,
		UserFormsModule,
		CardGridModule,
		AddTaskDialogModule,
		EmployeeMultiSelectModule,
		GauzyEditableGridModule,
		TasksSprintSettingsViewModule,
		TableFiltersModule,
		PaginationV2Module,
		ProjectSelectModule,
		TaskPrioritySelectModule,
		TaskSizeSelectModule,
		TaskStatusSelectModule,
		GauzyButtonActionModule,
		TaskNumberFieldModule
	]
})
export class TasksModule {}
