import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbSelectModule, NbInputModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { CandidateStore, EmployeeStore } from '@gauzy/ui-core/core';
import { EmployeeRatesComponent } from './employee-rates.component';
import { CurrencyModule } from '../../modules/currency';
import { PipesModule } from '../../pipes/pipes.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		// `NbCardModule` and `NbActionsModule` went with the rebuild: the two
		// `nb-card`s are two flat panels now, and nothing here uses `nb-actions`.
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbIconModule,
		TranslateModule.forChild(),
		PipesModule,
		CurrencyModule
	],
	exports: [EmployeeRatesComponent],
	declarations: [EmployeeRatesComponent],
	providers: [CandidateStore, EmployeeStore]
})
export class EmployeeRatesModule {}
