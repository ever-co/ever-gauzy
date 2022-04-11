import { Component } from '@angular/core';

@Component({
	selector: 'ga-edit-employee-rates',
	template: `
		<ga-employee-rates [isEmployee]="true"></ga-employee-rates>
	`,
	styles: [
		`
			:host {
				max-height: calc(100vh - 27rem);
			}
		`
	]
})
export class EditEmployeeRatesComponent {}
