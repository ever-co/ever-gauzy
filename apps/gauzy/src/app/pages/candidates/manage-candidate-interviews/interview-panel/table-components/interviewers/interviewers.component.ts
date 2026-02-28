import { Component, Input } from '@angular/core';

@Component({
    selector: 'ga-interview-interviewers',
    template: `
		@if (rowData.employees?.length > 0) {
		  <ngx-employee-with-links
		    [value]="rowData?.employees"
		  ></ngx-employee-with-links>
		}
		`,
    standalone: false
})
export class InterviewersTableComponent {
	@Input() rowData: any;
}
