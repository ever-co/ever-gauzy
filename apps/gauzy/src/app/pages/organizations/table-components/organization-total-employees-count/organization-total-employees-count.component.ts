import { Component, Input } from '@angular/core';

@Component({
    selector: 'ga-organizations-employees-table-selector',
    template: `
		<div class="m-2">
			<strong class="d-block">
				{{ value }}
			</strong>
		</div>
	`,
    standalone: false
})
export class OrganizationTotalEmployeesCountComponent {
	@Input() rowData: any;
	@Input() value: string | number;
}
