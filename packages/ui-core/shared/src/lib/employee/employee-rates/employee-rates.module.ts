import { NgModule } from '@angular/core';
import { CandidateStore, EmployeeStore } from '@gauzy/ui-core/core';
import { EmployeeRatesComponent } from './employee-rates.component';

@NgModule({
	imports: [EmployeeRatesComponent],
	exports: [EmployeeRatesComponent],
	providers: [CandidateStore, EmployeeStore]
})
export class EmployeeRatesModule { }
