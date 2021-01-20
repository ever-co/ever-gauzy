import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbActionsModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbSelectModule,
	NbInputModule
} from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { EmployeeRatesComponent } from './employee-rates.component';
import { CandidateStore } from '../../../@core/services/candidate-store.service';
import { EmployeeStore } from '../../../@core/services/employee-store.service';
import { CurrencyModule } from '../../currency/currency.module';
import { TranslaterModule } from '../../translater/translater.module';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbIconModule,
		ThemeModule,
		NbActionsModule,
		TranslaterModule,
		CurrencyModule
	],
	exports: [EmployeeRatesComponent],
	declarations: [EmployeeRatesComponent],
	entryComponents: [EmployeeRatesComponent],
	providers: [CandidateStore, EmployeeStore]
})
export class EmployeeRatesModule {}
