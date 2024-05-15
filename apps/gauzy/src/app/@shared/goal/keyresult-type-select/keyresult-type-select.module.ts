import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KeyresultTypeSelectComponent } from './keyresult-type-select.component';
import { NbSelectModule, NbInputModule, NbDialogModule } from '@nebular/theme';
import { ProjectSelectModule } from '../../project-select/project-select.module';
import { TaskSelectModule } from '../../tasks/task-select/task-select.module';
import { GoalCustomUnitModule } from '../goal-custom-unit/goal-custom-unit.module';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';

@NgModule({
	declarations: [KeyresultTypeSelectComponent],
	imports: [
		CommonModule,
		NbSelectModule,
		NbInputModule,
		ProjectSelectModule,
		TaskSelectModule,
		GoalCustomUnitModule,
		ReactiveFormsModule,
		NbDialogModule,
		TranslateModule
	],
	exports: [KeyresultTypeSelectComponent]
})
export class KeyresultTypeSelectModule {}
