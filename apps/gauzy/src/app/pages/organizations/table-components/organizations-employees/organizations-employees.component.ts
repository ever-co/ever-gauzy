import { Component, Input } from '@angular/core';

@Component({
	template: `
		<div class="m-2">
			<strong class="d-block">{{ value }}</strong>
		</div>
	`
})
export class OrganizationsEmployeesComponent {
	@Input()
	rowData: any;

	value: string | number;
}
