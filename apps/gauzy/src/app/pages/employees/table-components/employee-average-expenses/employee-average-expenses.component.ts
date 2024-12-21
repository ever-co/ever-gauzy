import { Component, Input } from '@angular/core';

@Component({
    selector: 'ga-employee-average-expenses',
    templateUrl: './employee-average-expenses.component.html',
    standalone: false
})
export class EmployeeAverageExpensesComponent {
	@Input() rowData: any;
	@Input() value: string | number;
}
