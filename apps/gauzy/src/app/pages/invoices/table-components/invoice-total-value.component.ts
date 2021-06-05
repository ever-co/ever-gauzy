import { Component, Input } from '@angular/core';

@Component({
	selector: 'ga-invoice-amount',
	template: `<span >{{ rowData?.currency }} {{ value }}</span>`,
})
export class InvoiceEstimateTotalValueComponent {
	@Input() value: Date;

	@Input()
	rowData: any;
}
