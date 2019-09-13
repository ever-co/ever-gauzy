import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	templateUrl: './employee-average-bonus.component.html'
})
export class EmployeeAverageBonusComponent implements ViewCell {
	@Input()
	rowData: any;

	value: string | number;
}
