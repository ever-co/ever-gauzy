import { Component, Input } from '@angular/core';

@Component({
	template: `
		<div>
			<div
				class="project-badge mr-2 mb-2 text-alternate"
				*ngFor="let project of rowData.projectNames"
			>
				{{ project }}
			</div>
		</div>
	`,
	styleUrls: ['./project-names.component.scss']
})
export class ProjectNamesComponent {
	@Input()
	rowData: any;

	value: string | number;
}
