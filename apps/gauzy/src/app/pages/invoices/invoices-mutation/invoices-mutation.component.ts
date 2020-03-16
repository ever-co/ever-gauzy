import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { CurrenciesEnum } from '@gauzy/models';

@Component({
	selector: 'ngx-invoices-mutation',
	templateUrl: './invoices-mutation.component.html',
	styleUrls: ['./invoices-mutation.component.scss']
})
export class InvoicesMutationComponent implements OnInit {
	form: FormGroup;
	currencies: string[];
	discountTypes: string[];

	constructor() {}
	ngOnInit(): void {
		this.currencies = Object.values(CurrenciesEnum);
		this.discountTypes = ['percentage', 'value'];
		this.initializeForm();
	}

	closeDialog() {
		console.log('close');
	}

	async initializeForm() {
		this.form = new FormGroup({
			invoiceDate: new FormControl(new Date(), []),
			invoiceNumber: new FormControl(1, []),
			dueDate: new FormControl(new Date(), []),
			currency: new FormControl('USD', []),
			discountValue: new FormControl('0', []),
			discountType: new FormControl('percentage', []),
			paid: new FormControl(false, []),
			tax: new FormControl(0, []),
			terms: new FormControl('', []),
			totalValue: new FormControl(0, [])
		});
	}
}
