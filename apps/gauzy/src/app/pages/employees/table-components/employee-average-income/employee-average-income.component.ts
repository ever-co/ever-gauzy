import { Component, Input } from '@angular/core';

@Component({
	templateUrl: './employee-average-income.component.html'
})
export class EmployeeAverageIncomeComponent {

	@Input() rowData: any;
	@Input() value: string | number;
}
