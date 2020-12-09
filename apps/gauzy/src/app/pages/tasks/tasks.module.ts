import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskComponent } from './components/task/task.component';
import { TasksRoutingModule } from './tasks-routing.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
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
	NbContextMenuModule
} from '@nebular/theme';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { DragDropModule } from '@angular/cdk/drag-drop';
import { SprintTaskComponent } from './components/task/tasks-layouts/tasks-sprint-view/task/task.component';
import { BackNavigationModule } from '../../@shared/back-navigation/back-navigation.module';
import { AddTaskDialogModule } from '../../@shared/tasks/add-task-dialog/add-task-dialog.module';
import { TasksSprintSettingsViewModule } from '../../@shared/tasks-sprint-settings-view/tasks-sprint-settings-view.module';

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
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbSpinnerModule,
		NbDatepickerModule,
		EmployeeMultiSelectModule,
		GauzyEditableGridModule,
		DragDropModule,
		BackNavigationModule,
		TasksSprintSettingsViewModule
	],
	entryComponents: [MyTaskDialogComponent, TeamTaskDialogComponent]
})
export class TasksModule {}
