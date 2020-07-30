import { Component, Input } from '@angular/core';

@Component({
	selector: 'ga-interview-criterions',
	template: `
		<ul style="padding-left:18px; margin:0;">
			<li *ngFor="let tech of this.rowData.technologies">
				<span> {{ tech.name }} </span>
			</li>

			<li *ngFor="let qual of this.rowData.personalQualities">
				<span> {{ qual.name }} </span>
			</li>
		</ul>
	`
})
export class InterviewCriterionsTableComponent {
	@Input()
	rowData: any;
}
