import { Component, OnInit } from '@angular/core';
import { DefaultEditor } from 'angular2-smart-table';

@Component({
    template: `
		<nb-toggle
			class="d-block apply-tax"
			status="primary"
			(checkedChange)="toggleSeparateTaxDiscount($event)"
		></nb-toggle>
	`,
    styles: ['.apply-tax {text-align: center}'],
    standalone: false
})
export class InvoiceApplyTaxDiscountComponent extends DefaultEditor implements OnInit {

	ngOnInit() {
		this.cell.setValue(this.cell.getValue());
	}

	/**
	 *
	 * @param $event
	 */
	toggleSeparateTaxDiscount($event) {
		this.cell.setValue($event);
	}
}
