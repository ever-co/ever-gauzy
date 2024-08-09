import { Component, OnChanges, SimpleChanges } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { IOrganizationVendor } from '@gauzy/contracts';

@Component({
	selector: 'ga-vendor-select-filter',
	template: `
		<ga-vendor-select
			[clearable]="true"
			[searchable]="false"
			[addTag]="false"
			[placeholder]="'SM_TABLE.VENDOR' | translate"
			(onChanged)="selectedVendorEvent($event)"
		></ga-vendor-select>
	`
})
export class VendorFilterComponent extends DefaultFilter implements OnChanges {
	constructor() {
		super();
	}

	/**
	 *
	 * @param changes
	 */
	ngOnChanges(changes: SimpleChanges) {}

	/**
	 *
	 * @param value
	 */
	selectedVendorEvent(value: IOrganizationVendor) {
		this.column.filterFunction(value, this.column.id);
	}
}
