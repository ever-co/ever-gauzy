import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoalLevelSelectComponent } from './goal-level-select.component';
import { NbInputModule, NbSelectModule } from '@nebular/theme';
import { ReactiveFormsModule } from '@angular/forms';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';
import { TranslateModule } from '../../translate/translate.module';

@NgModule({
	declarations: [GoalLevelSelectComponent],
	imports: [
		CommonModule,
		NbInputModule,
		ReactiveFormsModule,
		NbSelectModule,
		EmployeeMultiSelectModule,
		TranslateModule
	],
	exports: [GoalLevelSelectComponent],
	entryComponents: [GoalLevelSelectComponent]
})
export class GoalLevelSelectModule {}
