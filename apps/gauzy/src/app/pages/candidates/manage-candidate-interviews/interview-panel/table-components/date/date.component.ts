import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ga-interview-date',
    template: `
		<div class="start-column">
			<strong style="text-align:center;">{{ $safeNavigationMigration(rowData?.startTime) | date : 'shortDate' }} </strong>
			<span> {{ $safeNavigationMigration(rowData?.startTime) | date : 'shortTime' }}</span>
			<span>{{ $safeNavigationMigration(rowData?.endTime) | date : 'shortTime' }} </span>
		</div>
	`,
    styles: [
        `
			.start-column {
				display: flex;
				flex-direction: column;
				justify-content: center;
				align-items: flex-start;
			}
		`
    ],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class InterviewDateTableComponent {
	@Input() rowData: any;
}
