import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

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
export class ProjectNamesComponent implements ViewCell {
	@Input()
	rowData: any;

	value: string | number;
}
