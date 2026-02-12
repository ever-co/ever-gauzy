import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbDatepickerModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule,
	NbProgressBarModule,
	NbTabsetModule,
	NbActionsModule,
	NbLayoutModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import {
	EmployeeMultiSelectModule,
	GoalCustomUnitModule,
	GoalLevelSelectModule,
	SharedModule,
	TaskSelectModule
} from '@gauzy/ui-core/shared';
import { KeyResultProgressChartComponent } from './keyresult-progress-chart/keyresult-progress-chart.component';
import { EditObjectiveComponent } from './edit-objective/edit-objective.component';
import { EditKeyResultsComponent } from './edit-keyresults/edit-keyresults.component';
import { GoalDetailsComponent } from './goal-details/goal-details.component';
import { KeyResultDetailsComponent } from './keyresult-details/keyresult-details.component';
import { KeyResultUpdateComponent } from './keyresult-update/keyresult-update.component';
import { KeyResultParametersComponent } from './key-result-parameters/key-result-parameters.component';
import { GoalSettingsModule } from '../goal-settings/goal-settings.module';
import { GoalTemplateSelectModule } from './goal-template-select/goal-template-select.module';
import { KeyresultTypeSelectModule } from './keyresult-type-select/keyresult-type-select.module';
import { BaseChartDirective } from 'ng2-charts';

@NgModule({
	declarations: [
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
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbSelectModule,
		NbDatepickerModule,
		NbTooltipModule,
		NbSpinnerModule,
		NbProgressBarModule,
		NbTabsetModule,
		NbActionsModule,
		NbLayoutModule,
		SharedModule,
		GoalSettingsModule,
		GoalCustomUnitModule,
		KeyresultTypeSelectModule,
		GoalTemplateSelectModule,
		GoalLevelSelectModule,
		TaskSelectModule,
		TranslateModule,
		NgxPermissionsModule,
		EmployeeMultiSelectModule,
		BaseChartDirective
	],
	exports: [
		EditObjectiveComponent,
		EditKeyResultsComponent,
		GoalDetailsComponent,
		KeyResultDetailsComponent,
		KeyResultUpdateComponent,
		KeyResultProgressChartComponent,
		KeyResultParametersComponent
	]
})
export class GoalsComponentsModule {}
