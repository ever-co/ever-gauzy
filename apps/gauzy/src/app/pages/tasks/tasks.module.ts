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
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { GauzyButtonActionModule, PaginationV2Module } from '@gauzy/ui-sdk/shared';
import { TaskComponent } from './components/task/task.component';
import { TasksRoutingModule } from './tasks-routing.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { TableComponentsModule } from '@gauzy/ui-sdk/shared';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { EmployeeMultiSelectModule } from '../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { MyTaskDialogComponent } from './components/my-task-dialog/my-task-dialog.component';
import { TeamTaskDialogComponent } from './components/team-task-dialog/team-task-dialog.component';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { TaskSettingsComponent } from './components/task/task-settings/task-settings.component';
import { ProjectViewComponent } from './components/task/task-settings/project-view/project-view.component';
import { GauzyEditableGridModule } from '../../@shared/editable-grid/gauzy-editable-grid.module';
import { TasksSprintViewComponent } from './components/task/tasks-layouts/tasks-sprint-view/tasks-sprint-view.component';
import { SprintTaskComponent } from './components/task/tasks-layouts/tasks-sprint-view/task/task.component';
import { AddTaskDialogModule } from '../../@shared/tasks/add-task-dialog/add-task-dialog.module';
import { TasksSprintSettingsViewModule } from '../../@shared/tasks-sprint-settings-view/tasks-sprint-settings-view.module';
import { TableFiltersModule } from '../../@shared/table-filters/table-filters.module';
import { ProjectSelectModule } from '../../@shared/project-select/project-select.module';
import { TaskStatusSelectModule } from '../../@shared/tasks/task-status-select/task-status-select.module';
import { TaskNumberFieldModule } from '../../@shared/tasks/task-number/task-number-field.module';
import { TaskPrioritySelectModule } from '../../@shared/tasks/task-priority-select/task-priority-select.module';
import { TaskSizeSelectModule } from '../../@shared/tasks/task-size-select/task-size-select.module';
import { SharedModule } from '../../@shared/shared.module';

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
