import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NbInputModule, NbSelectModule, NbTooltipModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { GoalLevelSelectComponent } from './goal-level-select.component';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';

@NgModule({
	declarations: [GoalLevelSelectComponent],
	imports: [
		CommonModule,
		NbInputModule,
		NbTooltipModule,
		ReactiveFormsModule,
		NbSelectModule,
		EmployeeMultiSelectModule,
		I18nTranslateModule.forChild()
	],
	exports: [GoalLevelSelectComponent]
})
export class GoalLevelSelectModule {}
