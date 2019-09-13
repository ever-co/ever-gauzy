import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	templateUrl: './employee-average-income.component.html'
})
export class EmployeeAverageIncomeComponent implements ViewCell {
	@Input()
	rowData: any;

	value: string | number;
}
