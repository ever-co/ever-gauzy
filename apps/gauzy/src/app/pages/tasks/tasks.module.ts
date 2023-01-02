import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { TaskComponent } from './components/task/task.component';
import { TasksRoutingModule } from './tasks-routing.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
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
	NbTooltipModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { ThemeModule } from '../../@theme/theme.module';
import { NgSelectModule } from '@ng-select/ng-select';
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
import { TranslateModule } from '../../@shared/translate/translate.module';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { TableFiltersModule } from '../../@shared/table-filters/table-filters.module';
import { PaginationModule } from '../../@shared/pagination/pagination.module';
import { ProjectSelectModule } from '../../@shared/project-select/project-select.module';
import { TaskStatusSelectModule } from '../../@shared/tasks/task-status-select/task-status-select.module';
import { GauzyButtonActionModule } from '../../@shared/gauzy-button-action/gauzy-button-action.module';
import { TaskNumberFieldModule } from '../../@shared/tasks/task-number/task-number-field.module';

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
		Ng2SmartTableModule,
		UserFormsModule,
		CardGridModule,
		AddTaskDialogModule,
		TranslateModule,
		NbSpinnerModule,
		NbDatepickerModule,
		EmployeeMultiSelectModule,
		GauzyEditableGridModule,
		DragDropModule,
		BackNavigationModule,
		TasksSprintSettingsViewModule,
		HeaderTitleModule,
		TableFiltersModule,
		PaginationModule,
		ProjectSelectModule,
		TaskStatusSelectModule,
		GauzyButtonActionModule,
		TaskNumberFieldModule,
		NgxPermissionsModule.forChild()
	]
})
export class TasksModule {}
