import { Component, Input } from '@angular/core';

@Component({
    selector: 'ga-interview-criterions',
    template: `
		<ul style="padding-left: 10px; margin:0;">
		  @for (tech of rowData.technologies; track tech) {
		    <li>
		      <span> {{ tech.name }} </span>
		    </li>
		  }
		
		  @for (qual of rowData.personalQualities; track qual) {
		    <li>
		      <span> {{ qual.name }} </span>
		    </li>
		  }
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
