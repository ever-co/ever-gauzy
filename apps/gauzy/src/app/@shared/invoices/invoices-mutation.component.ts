import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Invoice } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { CurrenciesEnum } from '@gauzy/models';
import { Store } from '../../@core/services/store.service';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { OrganizationSelectInput } from '@gauzy/models';
import { InvoicesService } from '../../@core/services/invoices.service';
import { first } from 'rxjs/operators';

@Component({
	selector: 'ngx-invoices-mutation',
	templateUrl: './invoices-mutation.component.html',
	styleUrls: ['./invoices-mutation.component.scss']
})
export class InvoicesMutationComponent extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	invoice: Invoice;
	currencies = Object.values(CurrenciesEnum);
	selectedCurrency;

	get currency() {
		return this.form.get('currency');
	}

	constructor(
		protected dialogRef: NbDialogRef<InvoicesMutationComponent>,
		private fb: FormBuilder,
		readonly translateService: TranslateService,
		private invoicesService: InvoicesService,
		private store: Store,
		private organizationsService: OrganizationsService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.selectedCurrency = this.store.selectedOrganization
			? this.store.selectedOrganization.currency
			: this.currencies[0];
		this.initializeForm();
		this.form.get('currency').disable();
	}

	async initializeForm() {
		if (this.invoice) {
			console.log(this.invoice);
			this.form = this.fb.group({
				invoiceDate: [
					new Date(this.invoice.invoiceDate),
					Validators.required
				],
				invoiceNumber: [
					this.invoice.invoiceNumber,
					Validators.required
				],
				dueDate: [new Date(this.invoice.dueDate), Validators.required],
				currency: [this.selectedCurrency, Validators.required],
				discountValue: [
					this.invoice.discountValue,
					Validators.required
				],
				paid: [this.invoice.paid],
				tax: [this.invoice.tax, Validators.required],
				terms: [this.invoice.terms, Validators.required],
				totalValue: [this.invoice.totalValue, Validators.required],
				id: [this.invoice.id]
			});
		} else {
			this.form = this.fb.group({
				invoiceDate: ['', Validators.required],
				invoiceNumber: ['', Validators.required],
				dueDate: ['', Validators.required],
				currency: ['', Validators.required],
				discountValue: ['', Validators.required],
				paid: [''],
				tax: ['', Validators.required],
				terms: ['', Validators.required],
				totalValue: ['', Validators.required],
				id: ['']
			});
			this._loadDefaultCurrency();
		}
	}

	async saveInvoice() {
		if (!this.form.get('id').value) {
			delete this.form.value['id'];
		}
		const invoice = await this.invoicesService.save({
			...this.form.value,
			currency: this.selectedCurrency
		});
		this.closeDialog(invoice);
	}

	private async _loadDefaultCurrency() {
		const orgData = await this.organizationsService
			.getById(this.store.selectedOrganization.id, [
				OrganizationSelectInput.currency
			])
			.pipe(first())
			.toPromise();

		if (orgData && this.currency && !this.currency.value) {
			this.currency.setValue(orgData.currency);
		}
	}

	async closeDialog(invoice?: Invoice) {
		this.dialogRef.close(invoice);
	}
}
