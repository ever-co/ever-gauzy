import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ga-organizations-employees-table-selector',
    // See the currency cell beside this one: the `m-2` both carried indented these
    // two columns past the Name and Status columns, which add no margin of their own.
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
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class OrganizationTotalEmployeesCountComponent {
	@Input() rowData: any;
	@Input() value: string | number;
}
