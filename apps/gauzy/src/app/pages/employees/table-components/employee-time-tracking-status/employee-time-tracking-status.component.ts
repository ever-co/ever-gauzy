import { Component, Input, ChangeDetectionStrategy } from '@angular/core';


@Component({
    selector: 'employee-time-tracking-status',
    templateUrl: './employee-time-tracking-status.component.html',
    styleUrls: ['./../employee-work-status/employee-work-status.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class EmployeeTimeTrackingStatusComponent {
	@Input() rowData: any;

	value: string | number;
}
