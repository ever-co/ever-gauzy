import { NgModule } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
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
import { TranslateModule } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	AddTaskDialogModule,
	CardGridModule,
	EmployeeMultiSelectModule,
	GauzyEditableGridModule,
	ProjectSelectModule,
	SharedModule,
	TableFiltersModule,
	TagsColorInputModule,
	TaskNumberFieldModule,
	TaskPrioritySelectModule,
	TaskSizeSelectModule,
	TaskStatusSelectModule,
	TasksSprintSettingsViewModule,
	UserFormsModule,
	TableComponentsModule
} from '@gauzy/ui-core/shared';
import { TaskComponent } from './components/task/task.component';
import { TasksRoutingModule } from './tasks-routing.module';
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
		DragDropModule,
		NgxPermissionsModule.forChild(),
		CKEditorModule,
		TranslateModule.forChild(),
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
		SmartDataViewLayoutModule,
		ProjectSelectModule,
		TaskPrioritySelectModule,
		TaskSizeSelectModule,
		TaskStatusSelectModule,
		TaskNumberFieldModule
	]
})
export class TasksModule {}
