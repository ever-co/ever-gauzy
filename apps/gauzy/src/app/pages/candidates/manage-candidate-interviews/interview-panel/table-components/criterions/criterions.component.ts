import { Component, Input } from '@angular/core';

@Component({
	selector: 'ga-interview-criterions',
	template: `
		<div *ngFor="let tech of this.rowData.technologies">
			<span> {{ tech.name }} </span>
		</div>

		<div *ngFor="let qual of this.rowData.personalQualities">
			<span> {{ qual.name }} </span>
		</div>
	`
})
export class InterviewCriterionsTableComponent {
	@Input()
	rowData: any;
}
