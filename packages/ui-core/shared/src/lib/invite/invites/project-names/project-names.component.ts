import { Component, Input } from '@angular/core';

@Component({
    template: `
		<div>
		  @for (project of rowData.projectNames; track project) {
		    <div
		      class="project-badge mr-2 mb-2 text-alternate"
		      >
		      {{ project }}
		    </div>
		  }
		</div>
		`,
    styleUrls: ['./project-names.component.scss'],
    standalone: false
})
export class ProjectNamesComponent {
	@Input()
	rowData: any;

	value: string | number;
}
