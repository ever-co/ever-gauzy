import { Component, OnChanges, SimpleChanges } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { PaymentMethodEnum } from '@gauzy/contracts';

@Component({
	selector: 'ga-payment-method-filter',
	template: `
		<ng-select
			[clearable]="true"
			[closeOnSelect]="true"
			[placeholder]="'INVOICES_PAGE.PAYMENTS.PAYMENT_METHOD' | translate"
			(change)="onChange($event)"
		>
			<ng-option *ngFor="let paymentMethod of paymentMethods" [value]="paymentMethod">
				{{ 'INVOICES_PAGE.PAYMENTS.' + paymentMethod | translate }}
			</ng-option>
		</ng-select>
	`
})
export class PaymentMethodFilterComponent extends DefaultFilter implements OnChanges {
	public paymentMethods = Object.values(PaymentMethodEnum);

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
	onChange(value: PaymentMethodEnum) {
		console.log({ value });
		this.column.filterFunction(value, this.column.id);
	}
}
