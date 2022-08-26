import { Component } from '@angular/core';
@Component({
	selector: 'ga-edit-employee-location',
	template: `
		<ga-employee-location [isEmployee]="true"></ga-employee-location>
	`,
	styles: [
		`
			:host {
				overflow-y: auto;
				height: calc(100vh - 20.5rem);
			}
		`
	]
})
export class EditEmployeeLocationComponent {}
