import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ga-edit-employee-rates',
    template: `
		<ga-employee-rates [isEmployee]="true"></ga-employee-rates>
	`,
    styleUrls: ['./edit-employee-rate.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class EditEmployeeRatesComponent {}
