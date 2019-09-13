import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	templateUrl: './employee-average-expenses.component.html'
})
export class EmployeeAverageExpensesComponent implements ViewCell {
	@Input()
	rowData: any;

	value: string | number;
}
