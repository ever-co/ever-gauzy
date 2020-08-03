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
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { ThemeModule } from '../../@theme/theme.module';
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
import { TasksSprintSettingsViewComponent } from './components/task/task-settings/project-view/tasks-sprint-settings-view/tasks-sprint-settings-view.component';
import { GauzyEditableGridModule } from '../../@shared/components/editable-grid/gauzy-editable-grid.module';
import { SprintDialogComponent } from './components/task/task-settings/project-view/tasks-sprint-settings-view/sprint-dialog/sprint-dialog.component';
import { TasksSprintViewComponent } from './components/task/tasks-layouts/tasks-sprint-view/tasks-sprint-view.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { SprintTaskComponent } from './components/task/tasks-layouts/tasks-sprint-view/task/task.component';
import { BackNavigationModule } from '../../@shared/back-navigation/back-navigation.module';
import { TaskDialogModule } from '../../@shared/tasks/task-dialog/task-dialog.module';
export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	declarations: [
		TaskComponent,
		MyTaskDialogComponent,
		TeamTaskDialogComponent,
		TaskSettingsComponent,
		ProjectViewComponent,
		TasksSprintSettingsViewComponent,
		SprintDialogComponent,
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
		TaskDialogModule,
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
		BackNavigationModule
	],
	entryComponents: [MyTaskDialogComponent, TeamTaskDialogComponent]
})
export class TasksModule {}
