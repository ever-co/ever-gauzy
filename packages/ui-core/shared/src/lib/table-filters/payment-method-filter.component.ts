import { Component, OnChanges, type SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { RestorableFilterComponent } from './restorable-filter.component';
import { PaymentMethodEnum } from '@gauzy/contracts';

@Component({
	selector: 'ga-payment-method-filter',
	template: `
		<ng-select
			[ngModel]="restored"
			appendTo="body"
			[clearable]="true"
			[closeOnSelect]="true"
			[placeholder]="'INVOICES_PAGE.PAYMENTS.PAYMENT_METHOD' | translate"
			(change)="onChange($event)"
		>
			@for (paymentMethod of paymentMethods; track paymentMethod) {
				<ng-option [value]="paymentMethod">
					{{ 'INVOICES_PAGE.PAYMENTS.' + paymentMethod | translate }}
				</ng-option>
			}
		</ng-select>
	`,
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class PaymentMethodFilterComponent extends RestorableFilterComponent<PaymentMethodEnum> implements OnChanges {
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
		this.applyFilter(value);
	}
}
