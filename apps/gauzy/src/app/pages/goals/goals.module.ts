import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoalsRoutingModule } from './goals-routing.module';
import { GoalsComponent } from './goals.component';
import {
	NbSpinnerModule,
	NbCardModule,
	NbAccordionModule,
	NbButtonModule,
	NbInputModule,
	NbDialogModule,
	NbIconModule,
	NbSelectModule,
	NbDatepickerModule,
	NbActionsModule,
	NbTabsetModule,
	NbLayoutModule,
	NbProgressBarModule,
	NbToggleModule,
	NbContextMenuModule,
	NbListModule,
	NbPopoverModule,
	NbAlertModule,
	NbTooltipModule,
	NbFormFieldModule,
	NbBadgeModule
} from '@nebular/theme';
import { EditObjectiveComponent } from './edit-objective/edit-objective.component';
import { EditKeyResultsComponent } from './edit-keyresults/edit-keyresults.component';
import { ReactiveFormsModule } from '@angular/forms';
import { EmployeeSelectorsModule } from '../../@theme/components/header/selectors/employee/employee.module';
import { EmployeeMultiSelectModule } from '../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { GoalDetailsComponent } from './goal-details/goal-details.component';
import { SharedModule } from '../../@shared/shared.module';
import { KeyResultDetailsComponent } from './keyresult-details/keyresult-details.component';
import { KeyResultUpdateComponent } from './keyresult-update/keyresult-update.component';
import { KeyResultProgressChartComponent } from './keyresult-progress-chart/keyresult-progress-chart.component';
import { ChartModule } from 'angular2-chartjs';
import { GoalSettingsModule } from '../goal-settings/goal-settings.module';
import { KeyResultParametersComponent } from './key-result-parameters/key-result-parameters.component';
import { ProjectSelectModule } from '../../@shared/project-select/project-select.module';
import { TaskSelectModule } from '../../@shared/tasks/task-select/task-select.module';
import { GoalCustomUnitModule } from '../../@shared/goal/goal-custom-unit/goal-custom-unit.module';
import { KeyresultTypeSelectModule } from '../../@shared/goal/keyresult-type-select/keyresult-type-select.module';
import { GoalLevelSelectModule } from '../../@shared/goal/goal-level-select/goal-level-select.module';
import { GoalTemplateSelectModule } from '../../@shared/goal/goal-template-select/goal-template-select.module';
import { TranslateModule } from '../../@shared/translate/translate.module';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';

@NgModule({
	declarations: [
		GoalsComponent,
		EditObjectiveComponent,
		EditKeyResultsComponent,
		GoalDetailsComponent,
		KeyResultDetailsComponent,
		KeyResultUpdateComponent,
		KeyResultProgressChartComponent,
		KeyResultParametersComponent
	],
	imports: [
		CommonModule,
		GoalsRoutingModule,
		NbSpinnerModule,
		ReactiveFormsModule,
		NbCardModule,
		NbAccordionModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbSelectModule,
		NbActionsModule,
		NbDatepickerModule,
		NbTabsetModule,
		NbLayoutModule,
		NbToggleModule,
		NbProgressBarModule,
		NbContextMenuModule,
		NbListModule,
		SharedModule,
		NbPopoverModule,
		NbAlertModule,
		NbTooltipModule,
		NbFormFieldModule,
		NbBadgeModule,
		ChartModule,
		GoalSettingsModule,
		ProjectSelectModule,
		GoalCustomUnitModule,
		KeyresultTypeSelectModule,
		GoalTemplateSelectModule,
		GoalLevelSelectModule,
		TaskSelectModule,
		NbDialogModule.forChild(),
		TranslateModule,
		EmployeeSelectorsModule,
		EmployeeMultiSelectModule,
		HeaderTitleModule
	]
})
export class GoalsModule {}
