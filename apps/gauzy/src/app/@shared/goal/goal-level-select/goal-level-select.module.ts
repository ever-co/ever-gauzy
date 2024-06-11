import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NbInputModule, NbSelectModule, NbTooltipModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { EmployeeMultiSelectModule } from '@gauzy/ui-sdk/shared';
import { GoalLevelSelectComponent } from './goal-level-select.component';

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
