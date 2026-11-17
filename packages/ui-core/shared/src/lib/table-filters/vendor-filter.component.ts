import { Component, OnChanges, type SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { RestorableFilterComponent } from './restorable-filter.component';
import { IOrganizationVendor } from '@gauzy/contracts';

@Component({
	selector: 'ga-vendor-select-filter',
	template: `
		<ga-vendor-select
			[ngModel]="restored"
			[clearable]="true"
			[searchable]="false"
			[addTag]="false"
			[placeholder]="'SM_TABLE.VENDOR' | translate"
			(onChanged)="selectedVendorEvent($event)"
		></ga-vendor-select>
	`,
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class VendorFilterComponent extends RestorableFilterComponent<IOrganizationVendor> implements OnChanges {
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
		this.applyFilter(value);
	}
}
