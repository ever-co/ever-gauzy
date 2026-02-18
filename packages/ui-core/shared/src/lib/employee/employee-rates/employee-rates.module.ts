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
import { TranslateModule } from '@ngx-translate/core';
import { CandidateStore, EmployeeStore } from '@gauzy/ui-core/core';
import { EmployeeRatesComponent } from './employee-rates.component';
import { CurrencyModule } from '../../modules/currency';
import { ReplacePipe } from '../../pipes/replace.pipe';

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
		TranslateModule.forChild(),
		CurrencyModule,
		ReplacePipe
	],
	exports: [EmployeeRatesComponent],
	declarations: [EmployeeRatesComponent],
	providers: [CandidateStore, EmployeeStore]
})
export class EmployeeRatesModule {}
