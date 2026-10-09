import { Component } from '@angular/core';

@Component({
    selector: 'ga-edit-employee-rates',
    template: `
		<ga-employee-rates [isEmployee]="true"></ga-employee-rates>
	`,
    styleUrls: ['./edit-employee-rate.component.scss'],
    standalone: false
})
export class EditEmployeeRatesComponent {}
