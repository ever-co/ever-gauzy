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
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { HttpLoaderFactory } from '../../../@theme/theme.module';

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
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	]
})
export class GoalCustomUnitModule {}
