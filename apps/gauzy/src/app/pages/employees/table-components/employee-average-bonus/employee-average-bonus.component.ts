import { Component, Input } from '@angular/core';

@Component({
	selector: 'ga-employee-average-bonus',
	templateUrl: './employee-average-bonus.component.html'
})
export class EmployeeAverageBonusComponent {
	@Input()
	rowData: any;

	value: string | number;
}
