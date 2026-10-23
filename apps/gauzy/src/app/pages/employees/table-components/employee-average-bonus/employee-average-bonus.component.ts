import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ga-employee-average-bonus',
    templateUrl: './employee-average-bonus.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class EmployeeAverageBonusComponent {
	@Input()
	rowData: any;

	value: string | number;
}
