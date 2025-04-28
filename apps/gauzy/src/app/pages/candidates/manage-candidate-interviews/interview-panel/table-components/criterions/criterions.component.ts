import { Component, Input } from '@angular/core';

@Component({
    selector: 'ga-interview-criterions',
    template: `
		<ul style="padding-left: 10px; margin:0;">
			<li *ngFor="let tech of rowData.technologies">
				<span> {{ tech.name }} </span>
			</li>

			<li *ngFor="let qual of rowData.personalQualities">
				<span> {{ qual.name }} </span>
			</li>
		</ul>
	`,
    styles: [
        `
			ul {
				list-style-type: '- ';
			}
		`
    ],
    standalone: false
})
export class InterviewCriterionsTableComponent {
	@Input()
	rowData: any;
}
