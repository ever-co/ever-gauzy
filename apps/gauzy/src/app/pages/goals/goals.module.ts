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
import { GoalsComponentsModule } from './goals-components.module';
import { GoalSettingsModule } from '../goal-settings/goal-settings.module';
import { GoalTemplateSelectModule } from './goal-template-select/goal-template-select.module';
import { KeyresultTypeSelectModule } from './keyresult-type-select/keyresult-type-select.module';

@NgModule({
	imports: [
		GoalsComponentsModule,
		CommonModule, // Still needed? Likely transitively or for other things?
		// BaseChartDirective, // Removed as it is in ComponentsModule
		GoalsRoutingModule,
		NbSpinnerModule,
		// ReactiveFormsModule, // In ComponentsModule
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
