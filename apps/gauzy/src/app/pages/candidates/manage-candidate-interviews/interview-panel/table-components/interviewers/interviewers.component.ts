import { Component, Input } from '@angular/core';

@Component({
    selector: 'ga-interview-interviewers',
    template: `
		<ngx-employee-with-links
			*ngIf="rowData.employees?.length > 0"
			[value]="rowData?.employees"
		></ngx-employee-with-links>
	`,
    standalone: false
})
export class InterviewersTableComponent {
	@Input() rowData: any;
}
