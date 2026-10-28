import { NgModule } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
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
import { TranslatePipe } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	AddTaskDialogModule,
	CardGridModule,
	EmployeeMultiSelectModule,
	FavoriteToggleModule,
	GauzyEditableGridModule,
	ProjectSelectModule,
	RecordViewModule,
	RichTextEditorModule,
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
// Record-side Documents panel (spec 00 §6.14 R-LNK-02). Standalone, so it is
// imported directly — the Documents hub module is never pulled in here.
import { DocumentLinksPanelComponent } from '@gauzy/plugin-docs-ui';
// The employee page's hours chart, which the task page draws for the task. Standalone.
import { EmployeeHoursChartComponent } from '../employees/view-employee/employee-hours-chart/employee-hours-chart.component';
// The project page's board, which the task page draws for the task's subtasks. Standalone.
import { ProjectBoardComponent } from '../projects/components/project-view/project-board/project-board.component';
import { TaskComponent } from './components/task/task.component';
import { TaskViewHeaderComponent } from './components/task-view/task-view-header.component';
import { TaskViewPageComponent } from './components/task-view/task-view-page.component';
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
		TaskViewPageComponent,
		MyTaskDialogComponent,
		TeamTaskDialogComponent,
		TaskSettingsComponent,
		ProjectViewComponent,
		TasksSprintViewComponent,
		SprintTaskComponent
	],
	imports: [
		TaskViewHeaderComponent,
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
		RichTextEditorModule,
		TranslatePipe,
		TasksRoutingModule,
		TableComponentsModule,
		TagsColorInputModule,
		SharedModule,
		UserFormsModule,
		CardGridModule,
		AddTaskDialogModule,
		RecordViewModule,
		EmployeeMultiSelectModule,
		FavoriteToggleModule,
		GauzyEditableGridModule,
		TasksSprintSettingsViewModule,
		TableFiltersModule,
		SmartDataViewLayoutModule,
		ProjectSelectModule,
		TaskPrioritySelectModule,
		TaskSizeSelectModule,
		TaskStatusSelectModule,
		TaskNumberFieldModule,
		DocumentLinksPanelComponent,
		EmployeeHoursChartComponent,
		ProjectBoardComponent
	]
})
export class TasksModule {}
