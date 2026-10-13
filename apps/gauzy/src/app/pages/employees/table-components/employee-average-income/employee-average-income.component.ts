import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ga-employee-average-income',
    templateUrl: './employee-average-income.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class EmployeeAverageIncomeComponent {

	@Input() rowData: any;
	@Input() value: string | number;
}
