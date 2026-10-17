import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({
    selector: 'ga-edit-employee-location',
    template: `
		<ga-employee-location [isEmployee]="true"></ga-employee-location>
	`,
    styleUrls: ['./edit-employee-location.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class EditEmployeeLocationComponent {}
