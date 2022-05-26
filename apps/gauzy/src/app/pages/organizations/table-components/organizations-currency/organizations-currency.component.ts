import { Component, Input } from '@angular/core';

@Component({
	template: `
		<div class="m-2">
			<strong class="d-block">{{ value }}</strong>
		</div>
	`
})
export class OrganizationsCurrencyComponent {
	@Input()
	rowData: any;

	value: string | number;
}
