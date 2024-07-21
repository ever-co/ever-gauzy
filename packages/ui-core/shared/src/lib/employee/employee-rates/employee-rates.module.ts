import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbActionsModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbSelectModule,
	NbInputModule
} from '@nebular/theme';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { CandidateStore, EmployeeStore } from '@gauzy/ui-core/core';
import { EmployeeRatesComponent } from './employee-rates.component';
import { CurrencyModule } from '../../modules/currency';
import { PipesModule } from '../../pipes/pipes.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbIconModule,
		NbActionsModule,
		I18nTranslateModule.forChild(),
		PipesModule,
		CurrencyModule
	],
	exports: [EmployeeRatesComponent],
	declarations: [EmployeeRatesComponent],
	providers: [CandidateStore, EmployeeStore]
})
export class EmployeeRatesModule {}
