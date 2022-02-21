import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'employee-time-tracking-status',
	templateUrl: './employee-time-tracking-status.component.html',
	styleUrls: ['./../employee-work-status/employee-work-status.component.scss']
})
export class EmployeeTimeTrackingStatusComponent implements ViewCell {
	@Input()
	rowData: any;

	value: string | number;
}
