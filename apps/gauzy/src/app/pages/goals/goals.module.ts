import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
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
import { BaseChartDirective } from 'ng2-charts';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import {
	EmployeeMultiSelectModule,
	GoalCustomUnitModule,
	GoalLevelSelectModule,
	SharedModule,
	SmartDataViewLayoutModule,
	TaskSelectModule
} from '@gauzy/ui-core/shared';
import { GoalsRoutingModule } from './goals-routing.module';
import { GoalsComponent } from './goals.component';
import { EditObjectiveComponent } from './edit-objective/edit-objective.component';
import { EditKeyResultsComponent } from './edit-keyresults/edit-keyresults.component';
import { GoalDetailsComponent } from './goal-details/goal-details.component';
import { KeyResultDetailsComponent } from './keyresult-details/keyresult-details.component';
import { KeyResultUpdateComponent } from './keyresult-update/keyresult-update.component';
import { KeyResultProgressChartComponent } from './keyresult-progress-chart/keyresult-progress-chart.component';
import { GoalSettingsModule } from '../goal-settings/goal-settings.module';
import { KeyResultParametersComponent } from './key-result-parameters/key-result-parameters.component';
import { GoalTemplateSelectModule } from './goal-template-select/goal-template-select.module';
import { KeyresultTypeSelectModule } from './keyresult-type-select/keyresult-type-select.module';

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
		BaseChartDirective,
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
		GoalSettingsModule,
		GoalCustomUnitModule,
		KeyresultTypeSelectModule,
		GoalTemplateSelectModule,
		GoalLevelSelectModule,
		TaskSelectModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		EmployeeMultiSelectModule,
		SmartDataViewLayoutModule
	]
})
export class GoalsModule {}
