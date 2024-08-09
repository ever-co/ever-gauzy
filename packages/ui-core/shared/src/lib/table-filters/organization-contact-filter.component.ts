import { Component, OnChanges, SimpleChanges } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { IOrganizationContact } from '@gauzy/contracts';

@Component({
	selector: 'ga-contact-select-filter',
	template: `
		<ga-contact-select
			[clearable]="true"
			[placeholder]="'PAYMENTS_PAGE.CONTACT' | translate"
			(onChanged)="onChange($event)"
		></ga-contact-select>
	`
})
export class OrganizationContactFilterComponent extends DefaultFilter implements OnChanges {
	constructor() {
		super();
	}

	/**
	 *
	 *
	 */
	ngOnChanges(changes: SimpleChanges) {}

	/**
	 *
	 * @param value
	 */
	onChange(value: IOrganizationContact) {
		this.column.filterFunction(value, this.column.id);
	}
}
