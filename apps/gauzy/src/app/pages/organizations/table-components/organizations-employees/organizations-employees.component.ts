import { Component, Input } from '@angular/core';

@Component({
	template: `
		<div class="text-center">
			<strong class="d-block">{{ value }}</strong>
		</div>
	`
})
export class OrganizationsEmployeesComponent {
	@Input()
	rowData: any;

	value: string | number;
}
