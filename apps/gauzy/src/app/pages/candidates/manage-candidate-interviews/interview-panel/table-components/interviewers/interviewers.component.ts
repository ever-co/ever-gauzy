import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ga-interview-interviewers',
    template: `
		@if (rowData.employees?.length > 0) {
		  <ngx-employee-with-links
		    [value]="$safeNavigationMigration(rowData?.employees)"
		  ></ngx-employee-with-links>
		}
		`,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class InterviewersTableComponent {
	@Input() rowData: any;
}
