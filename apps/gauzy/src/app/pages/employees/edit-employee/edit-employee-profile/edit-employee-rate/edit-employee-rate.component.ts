import { Component } from '@angular/core';

@Component({
	selector: 'ga-edit-employee-rates',
	template: `
		<ga-employee-rates [isEmployee]="true"></ga-employee-rates>
	`,
	styles: [
		`
			:host {
        		overflow-y: auto;
				height: calc(100vh - 20.5rem);

				.actions {
					margin-bottom: 1.6rem;
				}
			}
		`
	]
})
export class EditEmployeeRatesComponent {}
