import { Component, Input } from '@angular/core';

@Component({
    template: `
		<div>
		  @for (department of rowData.departmentNames; track department) {
		    <div
		      class="department-badge mr-2 mb-2 text-alternate"
		      >
		      {{ department }}
		    </div>
		  }
		</div>
		`,
    styleUrls: ['./department-names.component.scss'],
    standalone: false
})
export class DepartmentNamesComponent {
	@Input()
	rowData: any;

	value: string | number;
}
