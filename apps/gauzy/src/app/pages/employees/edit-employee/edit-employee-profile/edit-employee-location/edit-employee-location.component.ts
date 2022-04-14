import { Component } from '@angular/core';
@Component({
	selector: 'ga-edit-employee-location',
	template: `
		<ga-employee-location [isEmployee]="true"></ga-employee-location>
	`,
	styles: [
		`
			:host {
				overflow-y: overlay;
				max-height: calc(100vh - 27rem);
			}
		`
	]
})
export class EditEmployeeLocationComponent {}
