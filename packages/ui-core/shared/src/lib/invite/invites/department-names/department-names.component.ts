import { Component, Input } from '@angular/core';

@Component({
	template: `
		<div>
			<div
				class="department-badge mr-2 mb-2 text-alternate"
				*ngFor="let department of rowData.departmentNames"
			>
				{{ department }}
			</div>
		</div>
	`,
	styleUrls: ['./department-names.component.scss']
})
export class DepartmentNamesComponent {
	@Input()
	rowData: any;

	value: string | number;
}
