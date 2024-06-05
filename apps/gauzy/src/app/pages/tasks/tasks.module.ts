import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { CKEditorModule } from 'ckeditor4-angular';
import { NgxPermissionsModule } from 'ngx-permissions';
import { NgSelectModule } from '@ng-select/ng-select';
import {
	NbSpinnerModule,
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbDialogModule,
	NbInputModule,
	NbSelectModule,
	NbBadgeModule,
	NbDatepickerModule,
	NbRadioModule,
	NbAccordionModule,
	NbListModule,
	NbTabsetModule,
	NbActionsModule,
	NbContextMenuModule,
	NbTooltipModule,
	NbPopoverModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { DirectivesModule } from '@gauzy/ui-sdk/shared';
import { TaskComponent } from './components/task/task.component';
import { TasksRoutingModule } from './tasks-routing.module';
import { ThemeModule } from '../../@theme/theme.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { EmployeeMultiSelectModule } from '../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { MyTaskDialogComponent } from './components/my-task-dialog/my-task-dialog.component';
import { TeamTaskDialogComponent } from './components/team-task-dialog/team-task-dialog.component';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { TaskSettingsComponent } from './components/task/task-settings/task-settings.component';
import { ProjectViewComponent } from './components/task/task-settings/project-view/project-view.component';
import { GauzyEditableGridModule } from '../../@shared/components/editable-grid/gauzy-editable-grid.module';
import { TasksSprintViewComponent } from './components/task/tasks-layouts/tasks-sprint-view/tasks-sprint-view.component';
import { SprintTaskComponent } from './components/task/tasks-layouts/tasks-sprint-view/task/task.component';
import { BackNavigationModule } from '../../@shared/back-navigation/back-navigation.module';
import { AddTaskDialogModule } from '../../@shared/tasks/add-task-dialog/add-task-dialog.module';
import { TasksSprintSettingsViewModule } from '../../@shared/tasks-sprint-settings-view/tasks-sprint-settings-view.module';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { TableFiltersModule } from '../../@shared/table-filters/table-filters.module';
import { PaginationV2Module } from '../../@shared/pagination/pagination-v2/pagination-v2.module';
import { ProjectSelectModule } from '../../@shared/project-select/project-select.module';
import { TaskStatusSelectModule } from '../../@shared/tasks/task-status-select/task-status-select.module';
import { GauzyButtonActionModule } from '../../@shared/gauzy-button-action/gauzy-button-action.module';
import { TaskNumberFieldModule } from '../../@shared/tasks/task-number/task-number-field.module';
import { TaskPrioritySelectModule } from '../../@shared/tasks/task-priority-select/task-priority-select.module';
import { TaskSizeSelectModule } from '../../@shared/tasks/task-size-select/task-size-select.module';

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
		TableComponentsModule,
		TagsColorInputModule,
		CommonModule,
		ThemeModule,
		NbCardModule,
		NbButtonModule,
		NgSelectModule,
		NbRadioModule,
		NbAccordionModule,
		NbIconModule,
		FormsModule,
		ReactiveFormsModule,
		TasksRoutingModule,
		NbInputModule,
		NbSelectModule,
		NbTabsetModule,
		NbActionsModule,
		NbDialogModule.forChild(),
		NbListModule,
		NbContextMenuModule,
		Angular2SmartTableModule,
		UserFormsModule,
		CardGridModule,
		AddTaskDialogModule,
		I18nTranslateModule.forChild(),
		NbSpinnerModule,
		NbDatepickerModule,
		EmployeeMultiSelectModule,
		GauzyEditableGridModule,
		DragDropModule,
		BackNavigationModule,
		TasksSprintSettingsViewModule,
		HeaderTitleModule,
		TableFiltersModule,
		PaginationV2Module,
		ProjectSelectModule,
		TaskPrioritySelectModule,
		TaskSizeSelectModule,
		TaskStatusSelectModule,
		GauzyButtonActionModule,
		TaskNumberFieldModule,
		NgxPermissionsModule.forChild(),
		DirectivesModule,
		CKEditorModule,
		NbPopoverModule
	]
})
export class TasksModule {}
