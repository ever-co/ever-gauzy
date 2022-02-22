import { Component, Input } from '@angular/core';

@Component({
	selector: 'ga-invoice-amount',
	template: `<span>{{
		value
			| currency: rowData?.currency
			| position: rowData?.fromOrganization?.currencyPosition
	}}</span>`
})
export class InvoiceEstimateTotalValueComponent {
	@Input() value: Date;

	@Input()
	rowData: any;
}
