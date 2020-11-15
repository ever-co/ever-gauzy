import { Component, OnInit } from '@angular/core';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import {
	IInvoice,
	CurrenciesEnum,
	IPayment,
	PaymentMethodEnum,
	IOrganization,
	IOrganizationContact,
	IOrganizationProject,
	ITag
} from '@gauzy/models';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { Store } from '../../../../@core/services/store.service';

@Component({
	selector: 'ga-payment-add',
	templateUrl: './payment-mutation.component.html',
	styleUrls: ['./payment-mutation.component.scss']
})
export class PaymentMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
	constructor(
		readonly translateService: TranslateService,
		private fb: FormBuilder,
		protected dialogRef: NbDialogRef<PaymentMutationComponent>,
		private store: Store,
		private toastrService: NbToastrService
	) {
		super(translateService);
	}

	invoice: IInvoice;
	invoices: IInvoice[];
	organization: IOrganization;
	payment: IPayment;
	form: FormGroup;
	currencies = Object.values(CurrenciesEnum);
	paymentMethods = Object.values(PaymentMethodEnum);
	currencyString: string;
	organizationContact: IOrganizationContact;
	organizationContacts: IOrganizationContact[];
	project: IOrganizationProject;
	projects: IOrganizationProject[];
	tags: ITag[] = [];
	get currency() {
		return this.form.get('currency');
	}

	ngOnInit() {
		this.initializeForm();
		if (this.currency && !this.currency.value) {
			if (this.invoice) {
				this.currency.setValue(this.invoice.currency);
			} else if (this.currencyString) {
				this.currency.setValue(this.currencyString);
			}
		}
		this.form.get('currency').disable();
	}

	initializeForm() {
		this.form = this.fb.group({
			amount: [
				'',
				Validators.compose([Validators.required, Validators.min(1)])
			],
			currency: ['', Validators.required],
			paymentDate: [new Date(), Validators.required],
			note: ['', Validators.required],
			paymentMethod: ['', Validators.required],
			invoiceId: [],
			contact: [],
			project: []
		});
		if (this.payment) {
			this.form.setValue({
				amount: this.payment.amount,
				currency: this.payment.currency,
				paymentDate: new Date(this.payment.paymentDate),
				note: this.payment.note,
				paymentMethod: this.payment.paymentMethod,
				invoiceId: this.payment.invoice
					? this.payment.invoice.id
					: null,
				contact: this.payment.contact,
				project: this.payment.project
			});
			this.form.updateValueAndValidity();
		}
	}

	async addEditPayment() {
		const paymentData = this.form.value;
		this.invoice = this.invoices.find(
			(item) => paymentData.invoiceId === item.id
		);
		const payment = {
			amount: paymentData.amount,
			paymentDate: paymentData.paymentDate,
			note: paymentData.note,
			currency: this.currency.value,
			invoice: this.invoice,
			invoiceId: paymentData.invoiceId,
			organization: this.invoice
				? this.invoice.fromOrganization
				: this.organization
				? this.organization
				: null,
			organizationId: this.invoice
				? this.invoice.organizationId
				: this.organization
				? this.organization.id
				: null,
			recordedBy: this.store.user,
			userId: this.store.userId,
			paymentMethod: paymentData.paymentMethod,
			contact: paymentData.contact,
			contactId: paymentData.contact ? paymentData.contact.id : null,
			project: paymentData.project,
			projectId: paymentData.project ? paymentData.project.id : null,
			tags: this.tags
		};

		if (this.invoice) {
			const overdue = this.compareDate(
				paymentData.paymentDate,
				this.invoice.dueDate
			);
			payment['overdue'] = overdue;
		} else if (paymentData.invoice) {
			const overdue = this.compareDate(
				paymentData.paymentDate,
				paymentData.invoice.dueDate
			);
			payment['overdue'] = overdue;
		}

		if (this.payment) {
			payment['id'] = this.payment.id;
		}

		this.toastrService.primary(
			this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_ADD'),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
		this.dialogRef.close(payment);
	}

	compareDate(date1: any, date2: any) {
		const d1 = new Date(date1);
		const d2 = new Date(date2);

		const same = d1.getTime() === d2.getTime();

		if (same) {
			return false;
		}

		return d1 > d2;
	}

	selectedTagsEvent(currentTagSelection: ITag[]) {
		this.tags = currentTagSelection;
	}

	searchOrganizationContact(term: string, item: any) {
		if (item.name) {
			return item.name.toLowerCase().includes(term.toLowerCase());
		}
	}

	selectOrganizationContact($event) {
		this.organizationContact = $event;
	}

	selectProject($event) {
		this.project = $event;
	}

	cancel() {
		this.dialogRef.close();
	}
}
