import { Component, OnInit } from '@angular/core';
import { DefaultEditor } from 'ng2-smart-table';

@Component({
	template: `
		<nb-toggle
			class="d-block apply-tax"
			status="primary"
			(checkedChange)="toggleSeparateTaxDiscount($event)"
			[ngModel]="cell.newValue"
		>
		</nb-toggle>
	`,
	styles: ['.apply-tax {text-align: center}']
})
export class InvoiceApplyTaxDiscountComponent extends DefaultEditor
	implements OnInit {
	ngOnInit() {
		this.cell.newValue = this.cell.newValue ? this.cell.newValue : false;
	}

	toggleSeparateTaxDiscount($event) {
		this.cell.newValue = $event;
	}
}
