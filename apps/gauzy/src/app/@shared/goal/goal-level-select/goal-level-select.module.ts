import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoalLevelSelectComponent } from './goal-level-select.component';
import { NbInputModule, NbSelectModule, NbTooltipModule } from '@nebular/theme';
import { ReactiveFormsModule } from '@angular/forms';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';

@NgModule({
	declarations: [GoalLevelSelectComponent],
	imports: [
		CommonModule,
		NbInputModule,
		NbTooltipModule,
		ReactiveFormsModule,
		NbSelectModule,
		EmployeeMultiSelectModule,
		TranslateModule
	],
	exports: [GoalLevelSelectComponent]
})
export class GoalLevelSelectModule {}
