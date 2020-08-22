import { Component, Input } from '@angular/core';

@Component({
	selector: 'ga-interview-date',
	template: `
		<div class="start-column">
			<strong style="text-align:center;"
				>{{ rowData?.startTime | date: 'shortDate' }}
			</strong>
			<span> {{ rowData?.startTime | date: 'shortTime' }}</span>
			<span>{{ rowData?.endTime | date: 'shortTime' }} </span>
		</div>
	`,
	styles: [
		`
			.start-column {
				display: flex;
				flex-direction: column;
				justify-content: center;
				align-items: center;
			}
		`
	]
})
export class InterviewDateTableComponent {
	@Input()
	rowData: any;
}
