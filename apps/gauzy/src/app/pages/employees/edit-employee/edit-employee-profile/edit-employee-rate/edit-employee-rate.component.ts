import { Component } from '@angular/core';

@Component({
	selector: 'ga-edit-employee-rates',
	template: `
		<ga-employee-rates [isEmployee]="true"></ga-employee-rates>
	`,
	styles: [
		`
			:host {
        overflow-y: overlay;
				max-height: calc(100vh - 28rem);
			}
		`
	]
})
export class EditEmployeeRatesComponent {}
