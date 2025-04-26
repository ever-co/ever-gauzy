import { Component, Input } from '@angular/core';


@Component({
    selector: 'employee-time-tracking-status',
    templateUrl: './employee-time-tracking-status.component.html',
    styleUrls: ['./../employee-work-status/employee-work-status.component.scss'],
    standalone: false
})
export class EmployeeTimeTrackingStatusComponent {
	@Input() rowData: any;

	value: string | number;
}
