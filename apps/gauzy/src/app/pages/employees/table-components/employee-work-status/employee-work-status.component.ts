import { Component, Input } from '@angular/core';


@Component({
    selector: 'ga-employee-work-status',
    templateUrl: './employee-work-status.component.html',
    styleUrls: ['./employee-work-status.component.scss'],
    standalone: false
})
export class EmployeeWorkStatusComponent {
	@Input()
	rowData: any;

	value: string | number;
}
