import { Component, OnChanges, type SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { RestorableFilterComponent } from './restorable-filter.component';
import { IOrganizationContact } from '@gauzy/contracts';

@Component({
	selector: 'ga-contact-select-filter',
	template: `
		<ga-contact-select
			[ngModel]="restored"
			[clearable]="true"
			[placeholder]="'PAYMENTS_PAGE.CONTACT' | translate"
			(onChanged)="onChange($event)"
		></ga-contact-select>
	`,
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class OrganizationContactFilterComponent
	extends RestorableFilterComponent<IOrganizationContact>
	implements OnChanges
{
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
		this.applyFilter(value);
	}
}
