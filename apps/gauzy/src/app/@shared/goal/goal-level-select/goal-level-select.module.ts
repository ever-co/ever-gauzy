import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoalLevelSelectComponent } from './goal-level-select.component';
import { NbInputModule, NbSelectModule } from '@nebular/theme';
import { ReactiveFormsModule } from '@angular/forms';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';
import { TranslaterModule } from '../../translater/translater.module';

@NgModule({
	declarations: [GoalLevelSelectComponent],
	imports: [
		CommonModule,
		NbInputModule,
		ReactiveFormsModule,
		NbSelectModule,
		EmployeeMultiSelectModule,
		TranslaterModule
	],
	exports: [GoalLevelSelectComponent],
	entryComponents: [GoalLevelSelectComponent]
})
export class GoalLevelSelectModule {}
