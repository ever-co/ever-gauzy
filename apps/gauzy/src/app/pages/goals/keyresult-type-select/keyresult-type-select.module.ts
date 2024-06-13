import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NbSelectModule, NbInputModule, NbDialogModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { GoalCustomUnitModule, ProjectSelectModule, TaskSelectModule } from '@gauzy/ui-sdk/shared';
import { KeyresultTypeSelectComponent } from './keyresult-type-select.component';

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
		I18nTranslateModule.forChild()
	],
	exports: [KeyresultTypeSelectComponent]
})
export class KeyresultTypeSelectModule {}
