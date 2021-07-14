import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoalCustomUnitSelectComponent } from './goal-custom-unit-select.component';
import {
	NbSelectModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule
} from '@nebular/theme';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CurrencyModule } from '../../currency/currency.module';
import { TranslateModule } from '../../translate/translate.module';

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
		TranslateModule
	]
})
export class GoalCustomUnitModule {}
