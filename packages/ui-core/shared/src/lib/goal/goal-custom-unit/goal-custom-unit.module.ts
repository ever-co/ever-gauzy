import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NbSelectModule, NbFormFieldModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { GoalCustomUnitSelectComponent } from './goal-custom-unit-select.component';
import { CurrencyModule } from '../../modules/currency/currency.module';

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
