import { Component, Input } from '@angular/core';

@Component({
	templateUrl: './employee-average-expenses.component.html'
})
export class EmployeeAverageExpensesComponent {
	@Input()
	rowData: any;

	value: string | number;
}
