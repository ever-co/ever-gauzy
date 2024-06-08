import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NbSelectModule, NbFormFieldModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { CurrencyModule } from '@gauzy/ui-sdk/shared';
import { GoalCustomUnitSelectComponent } from './goal-custom-unit-select.component';

@NgModule({
	declarations: [GoalCustomUnitSelectComponent],
	exports: [GoalCustomUnitSelectComponent],
	imports: [
		CommonModule,
		NbSelectModule,
		NbFormFieldModule,
		NbIconModule,
		ReactiveFormsModule,
		FormsModule,
		NbInputModule,
		CurrencyModule,
		I18nTranslateModule.forChild()
	]
})
export class GoalCustomUnitModule {}
