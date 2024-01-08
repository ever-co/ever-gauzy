import { Component, Input } from '@angular/core';

@Component({
	templateUrl: './employee-average-bonus.component.html'
})
export class EmployeeAverageBonusComponent {
	@Input()
	rowData: any;

	value: string | number;
}
