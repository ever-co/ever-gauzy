import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbSelectModule, NbFormFieldModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { GoalCustomUnitSelectComponent } from './goal-custom-unit-select.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CurrencyModule } from '../../currency/currency.module';

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
