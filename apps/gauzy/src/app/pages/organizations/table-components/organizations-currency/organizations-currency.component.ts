import { Component, Input } from '@angular/core';

@Component({
    selector: 'ga-organization-currency-table-selector',
    template: `
		<div class="m-2">
			<strong class="d-block">{{ value }}</strong>
		</div>
	`,
    standalone: false
})
export class OrganizationsCurrencyComponent {
	@Input()
	rowData: any;

	value: string | number;
}
