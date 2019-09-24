import { Component, Input } from '@angular/core';

@Component({
	template: `
		<div class="text-center">
			<strong class="d-block">{{ value }}</strong>
		</div>
	`
})
export class OrganizationsCurrencyComponent {
	@Input()
	rowData: any;

	value: string | number;
}
