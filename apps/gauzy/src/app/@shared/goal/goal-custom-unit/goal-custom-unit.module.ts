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
import { TranslaterModule } from '../../translater/translater.module';

@NgModule({
	declarations: [GoalCustomUnitSelectComponent],
	exports: [GoalCustomUnitSelectComponent],
	entryComponents: [GoalCustomUnitSelectComponent],
	imports: [
		CommonModule,
		NbSelectModule,
		NbFormFieldModule,
		NbIconModule,
		ReactiveFormsModule,
		FormsModule,
		NbInputModule,
		CurrencyModule,
		TranslaterModule
	]
})
export class GoalCustomUnitModule {}
