import { Component, Input } from '@angular/core';

@Component({
    selector: 'ga-organization-currency-table-selector',
    // Was `<div class="m-2">`, a 0.5rem margin inside a cell the table already
    // pads. The Name and Status columns add none, so this column and the employee
    // count beside it sat half a step in from every other column in the row.
    template: `
		<div class="cell-value">{{ value }}</div>
	`,
    styles: [
        `
			.cell-value {
				font-weight: 600;
			}
		`
    ],
    standalone: false
})
export class OrganizationsCurrencyComponent {
	@Input()
	rowData: any;

	value: string | number;
}
