import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NbSelectModule, NbInputModule, NbDialogModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { KeyresultTypeSelectComponent } from './keyresult-type-select.component';
import { ProjectSelectModule } from '../../project-select/project-select.module';
import { TaskSelectModule } from '../../tasks/task-select/task-select.module';
import { GoalCustomUnitModule } from '../goal-custom-unit/goal-custom-unit.module';

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
